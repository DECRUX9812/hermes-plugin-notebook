"""WebSocket stream: refused without a session, replays with ``since``, streams live."""

from __future__ import annotations

from starlette.testclient import TestClient

from hwh.config import Config
from hwh.server.app import create_app


def _authed_client(cfg: Config, token: str) -> TestClient:
    client = TestClient(create_app(cfg))
    client.__enter__()
    response = client.get(f"/login?t={token}", follow_redirects=False)
    assert response.status_code == 303
    return client


def test_websocket_without_a_cookie_gets_no_hello(cfg: Config):
    with TestClient(create_app(cfg)) as client:
        received = None
        try:
            with client.websocket_connect("/api/ws") as socket:
                received = socket.receive_json()
        except Exception:
            received = None
        assert received is None


def test_websocket_replays_the_backlog_then_streams_live(cfg: Config):
    from hwh.server.auth import AuthManager

    token = AuthManager(cfg).token()
    client = _authed_client(cfg, token)
    try:
        thread = client.post("/api/threads", json={"title": "ws thread"}).json()["thread"]
        client.post(f"/api/threads/{thread['id']}/messages", json={"text": "hello over http"})

        # wait for the run to finish so the backlog is stable
        for _ in range(200):
            detail = client.get(f"/api/threads/{thread['id']}").json()
            if detail["thread"]["status"] == "idle" and all(
                run["status"] not in ("queued", "running") for run in detail["runs"]
            ):
                break
            import time

            time.sleep(0.02)

        with client.websocket_connect(f"/api/ws?thread_id={thread['id']}&since=0") as socket:
            hello = socket.receive_json()
            assert hello["type"] == "hello"
            assert hello["thread_id"] == thread["id"]

            types: list[str] = []
            while True:
                frame = socket.receive_json()
                if frame["type"] == "replayed":
                    break
                assert frame["type"] == "event"
                types.append(frame["event"]["type"])
            assert "message.appended" in types
            assert "run.finished" in types

        with client.websocket_connect(f"/api/ws?thread_id={thread['id']}&since=2") as socket:
            assert socket.receive_json()["type"] == "hello"
            first = socket.receive_json()
            assert first["type"] == "event"
            assert first["event"]["seq"] == 3
    finally:
        client.__exit__(None, None, None)


def test_websocket_streams_a_live_run(cfg: Config):
    from hwh.server.auth import AuthManager

    token = AuthManager(cfg).token()
    client = _authed_client(cfg, token)
    try:
        thread = client.post("/api/threads", json={"title": "live"}).json()["thread"]
        with client.websocket_connect(f"/api/ws?thread_id={thread['id']}") as socket:
            assert socket.receive_json()["type"] == "hello"
            client.post(f"/api/threads/{thread['id']}/messages", json={"text": "run it"})
            seen: set[str] = set()
            for _ in range(400):
                frame = socket.receive_json()
                if frame["type"] != "event":
                    continue
                seen.add(frame["event"]["type"])
                if frame["event"]["type"] == "run.finished":
                    break
            assert {"message.appended", "run.started", "run.finished"} <= seen
    finally:
        client.__exit__(None, None, None)
