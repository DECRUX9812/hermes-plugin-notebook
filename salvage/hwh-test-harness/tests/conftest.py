"""Shared fixtures: temp config, temp git repo, live harness, authed client."""

from __future__ import annotations

import subprocess
from pathlib import Path

import httpx
import pytest
import pytest_asyncio

from hwh.config import Config
from hwh.server.app import create_app
from hwh.server.harness import Harness


@pytest.fixture
def cfg(tmp_path: Path) -> Config:
    config = Config()
    config.storage.data_dir = str(tmp_path / "data")
    config.storage.db_path = ""
    config.storage.worktrees_dir = ""
    config.server.host = "127.0.0.1"
    config.server.port = 9230
    config.auth.mode = "token"
    config.runtime.name = "mock"
    config.execution.turn_timeout_seconds = 20
    config.execution.max_concurrent_runs = 4
    config.ensure_dirs()
    return config


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    path = tmp_path / "repo"
    path.mkdir()
    (path / "README.md").write_text("# test repo\n")
    subprocess.run(["git", "init", "-b", "main"], cwd=path, check=True,
                   capture_output=True)
    subprocess.run(["git", "add", "-A"], cwd=path, check=True, capture_output=True)
    subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@t.t", "commit", "-m", "seed"],
        cwd=path, check=True, capture_output=True,
    )
    return path


@pytest_asyncio.fixture
async def harness(cfg: Config) -> Harness:
    h = await Harness.create(cfg)
    try:
        yield h
    finally:
        await h.close()


@pytest_asyncio.fixture
async def client(cfg: Config, harness: Harness):
    app = create_app(cfg, harness=harness)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
        token = harness.auth.token()
        response = await http.get(f"/login?t={token}", follow_redirects=False)
        assert response.status_code == 303
        yield http


@pytest_asyncio.fixture
async def wait_idle():
    """Poll a thread until no run is queued or running (mock runs are fast)."""
    import asyncio
    import time

    async def _wait(http, thread_id: str, timeout: float = 15.0) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            response = await http.get(f"/api/threads/{thread_id}")
            data = response.json()
            status = data["thread"]["status"]
            busy = any(run["status"] in ("queued", "running") for run in data["runs"])
            if status in ("idle", "failed") and not busy:
                return data
            await asyncio.sleep(0.02)
        raise AssertionError(f"thread {thread_id} did not settle in {timeout}s")

    return _wait


@pytest_asyncio.fixture
async def project(client, repo: Path) -> dict:
    response = await client.post("/api/projects",
                                 json={"name": "testrepo", "local_path": str(repo)})
    assert response.status_code == 201, response.text
    return response.json()["project"]


@pytest_asyncio.fixture
async def environment(client, project: dict) -> dict:
    response = await client.post("/api/environments",
                                 json={"project_id": project["id"], "kind": "worktree"})
    assert response.status_code == 201, response.text
    return response.json()["environment"]
