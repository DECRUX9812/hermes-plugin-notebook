"""Environment-scoped PTYs: policy, output ring, resize, exit codes, WS (design §8.5)."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import httpx
import pytest
import pytest_asyncio

from hwh.orchestrator.terminals import TerminalError
from hwh.server.app import create_app


async def drain(terminal, marker: str, *, start: int = 0, timeout: float = 8.0) -> tuple[str, int]:
    """Read until ``marker`` shows up, so tests never depend on a single chunk."""
    offset = start
    text = ""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        chunk, offset = terminal.read_from(offset)
        text += chunk
        if marker in text:
            return text, offset
        await asyncio.sleep(0.02)
    raise AssertionError(f"{marker!r} never appeared; last output: {text[-400:]!r}")


async def settle(terminal, timeout: float = 8.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline and terminal.status == "running":
        await asyncio.sleep(0.02)
    assert terminal.status == "exited"


# -- registry ----------------------------------------------------------------
@pytest.mark.asyncio
async def test_terminal_starts_in_the_environment_directory(harness, environment):
    terminal = harness.terminals.open(environment)
    try:
        expected = str(Path(environment["path"]).resolve())
        await harness.terminals.write(terminal.id, "pwd\n")
        text, _ = await drain(terminal, expected)  # the echoed command has no path in it
        assert expected in text
        assert terminal.cwd == Path(environment["path"])
    finally:
        await harness.terminals.close(terminal.id)


@pytest.mark.asyncio
async def test_terminal_reports_its_exit_code(harness, environment):
    terminal = harness.terminals.open(environment)
    await harness.terminals.write(terminal.id, "exit 3\n")
    await settle(terminal)
    assert terminal.exit_code == 3
    snapshot = await harness.terminals.close(terminal.id)
    assert snapshot["status"] == "exited"
    assert harness.terminals.list() == []


@pytest.mark.asyncio
async def test_terminal_refuses_a_read_only_environment(harness, environment):
    read_only = {**environment, "preset": "read-only"}
    with pytest.raises(TerminalError) as excinfo:
        harness.terminals.open(read_only)
    assert excinfo.value.code == "preset_refused"


@pytest.mark.asyncio
async def test_terminal_is_off_when_the_host_says_so(harness, environment):
    harness.config.terminal.enabled = False
    with pytest.raises(TerminalError) as excinfo:
        harness.terminals.open(environment)
    assert excinfo.value.code == "terminal_disabled"


@pytest.mark.asyncio
async def test_terminal_limit_is_enforced(harness, environment):
    harness.config.terminal.max_terminals = 1
    first = harness.terminals.open(environment)
    try:
        with pytest.raises(TerminalError) as excinfo:
            harness.terminals.open(environment)
        assert excinfo.value.code == "too_many_terminals"
    finally:
        await harness.terminals.close(first.id)
    second = harness.terminals.open(environment)
    await harness.terminals.close(second.id)


@pytest.mark.asyncio
async def test_offset_resumes_without_duplicating_output(harness, environment):
    terminal = harness.terminals.open(environment)
    try:
        await harness.terminals.write(terminal.id, "echo hwh-marker-1\n")
        _, offset = await drain(terminal, "hwh-marker-1")
        later, _ = terminal.read_from(offset)
        assert "hwh-marker-1" not in later
    finally:
        await harness.terminals.close(terminal.id)


@pytest.mark.asyncio
async def test_resize_reaches_the_kernel(harness, environment):
    terminal = harness.terminals.open(environment, cols=100, rows=30)
    try:
        snapshot = await harness.terminals.resize(terminal.id, 72, 24)
        assert (snapshot["cols"], snapshot["rows"]) == (72, 24)
        await harness.terminals.write(terminal.id, "stty size\n")
        text, _ = await drain(terminal, "24 72")
        assert "24 72" in text
    finally:
        await harness.terminals.close(terminal.id)


@pytest.mark.asyncio
async def test_idle_unwatched_terminal_is_reaped(harness, environment):
    terminal = harness.terminals.open(environment)
    assert await harness.terminals.reap_idle(idle_seconds=60) == 0
    await asyncio.sleep(0.05)
    assert await harness.terminals.reap_idle(idle_seconds=0) == 1
    assert harness.terminals.list() == []
    assert terminal.status == "exited"


@pytest.mark.asyncio
async def test_watched_terminal_is_not_reaped(harness, environment):
    terminal = harness.terminals.open(environment)
    queue = harness.terminals.subscribe(terminal.id)
    assert await harness.terminals.reap_idle(idle_seconds=0) == 0
    harness.terminals.unsubscribe(terminal.id, queue)
    await asyncio.sleep(0.05)
    assert await harness.terminals.reap_idle(idle_seconds=0) == 1
    assert harness.terminals.list() == []


# -- HTTP surface ------------------------------------------------------------
@pytest.mark.asyncio
async def test_terminal_api_round_trip(client, environment):
    created = await client.post("/api/terminals", json={"environment_id": environment["id"]})
    assert created.status_code == 201, created.text
    payload = created.json()
    terminal_id = payload["terminal"]["id"]
    assert payload["ws"] == f"/api/terminals/{terminal_id}/ws"

    listed = await client.get("/api/terminals", params={"environment_id": environment["id"]})
    assert listed.json()["enabled"] is True
    assert [t["id"] for t in listed.json()["terminals"]] == [terminal_id]

    polled = await client.get(f"/api/terminals/{terminal_id}", params={"offset": 0})
    assert polled.status_code == 200
    assert isinstance(polled.json()["output"], str)

    resized = await client.post(f"/api/terminals/{terminal_id}/resize",
                                json={"cols": 64, "rows": 20})
    assert resized.json()["terminal"]["cols"] == 64

    closed = await client.delete(f"/api/terminals/{terminal_id}")
    assert closed.status_code == 200
    assert closed.json()["terminal"]["status"] in ("exited", "running")
    missing = await client.get(f"/api/terminals/{terminal_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_terminal_api_needs_an_environment(client):
    response = await client.post("/api/terminals", json={"environment_id": "env-nope"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.asyncio
async def test_terminal_api_requires_a_session(cfg, harness):
    app = create_app(cfg, harness=harness)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                 base_url="http://testserver") as anon:
        response = await anon.post("/api/terminals", json={"environment_id": "env-any"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_deleting_an_environment_closes_its_terminals(client, environment):
    created = await client.post("/api/terminals", json={"environment_id": environment["id"]})
    assert created.status_code == 201, created.text
    deleted = await client.delete(f"/api/environments/{environment['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["terminals_closed"] == 1
    listed = await client.get("/api/terminals")
    assert listed.json()["terminals"] == []


# -- live websocket ----------------------------------------------------------
@pytest_asyncio.fixture
async def live_url(cfg, harness):
    """A real uvicorn server on this event loop, so the WS path is exercised end to end."""
    uvicorn = pytest.importorskip("uvicorn")

    config = uvicorn.Config(create_app(cfg, harness=harness), host="127.0.0.1", port=0,
                            log_level="error", lifespan="off")
    server = uvicorn.Server(config)
    task = asyncio.create_task(server.serve())
    deadline = time.monotonic() + 15
    while not server.started and time.monotonic() < deadline:
        await asyncio.sleep(0.02)
    if not server.started:  # pragma: no cover - environment problem
        task.cancel()
        pytest.skip("uvicorn did not start")
    port = server.servers[0].sockets[0].getsockname()[1]
    try:
        yield f"http://127.0.0.1:{port}", f"ws://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        await asyncio.wait_for(task, timeout=10)


@pytest.mark.asyncio
async def test_terminal_websocket_streams_and_accepts_input(cfg, harness, environment, live_url):
    websockets = pytest.importorskip("websockets")
    http_base, ws_base = live_url

    async with httpx.AsyncClient(base_url=http_base) as http:
        await http.get(f"/login?t={harness.auth.token()}", follow_redirects=False)
        cookie = http.cookies.get("hwh_session")
        assert cookie
        created = await http.post("/api/terminals",
                                  json={"environment_id": environment["id"]})
        assert created.status_code == 201, created.text
        terminal_id = created.json()["terminal"]["id"]

        url = f"{ws_base}/api/terminals/{terminal_id}/ws"
        headers = {"cookie": f"hwh_session={cookie}"}
        try:
            socket = await websockets.connect(url, additional_headers=headers)
        except TypeError:  # websockets < 13 spells it extra_headers
            socket = await websockets.connect(url, extra_headers=headers)
        try:
            hello = await asyncio.wait_for(socket.recv(), timeout=10)
            assert "terminal.hello" in hello
            await socket.send('{"type":"input","data":"echo hwh-pty-ok\\r"}')
            seen = ""
            deadline = time.monotonic() + 15
            while "hwh-pty-ok" not in seen and time.monotonic() < deadline:
                seen += await asyncio.wait_for(socket.recv(), timeout=15)
            assert "hwh-pty-ok" in seen
            await socket.send('{"type":"resize","cols":90,"rows":30}')
        finally:
            await socket.close()
        closed = await http.delete(f"/api/terminals/{terminal_id}")
        assert closed.status_code == 200
