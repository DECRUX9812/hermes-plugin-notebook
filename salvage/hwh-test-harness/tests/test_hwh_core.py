from pathlib import Path

from hwh.config import Config, _as_bool, _as_int
from hwh.gitops import GitResult, git_available, is_git_repo
from hwh.ids import new_id, ulid


def test_ulid_format_and_uniqueness():
    id1 = ulid()
    id2 = ulid()
    assert len(id1) == 26
    assert len(id2) == 26
    assert id1 != id2
    for c in id1 + id2:
        assert c in "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

def test_new_id_prefix():
    tid = new_id("thread")
    assert tid.startswith("hwh_thread_")
    assert len(tid) == len("hwh_thread_") + 26

def test_config_defaults():
    cfg = Config()
    assert cfg.server.port == 9230
    assert cfg.server.host == "127.0.0.1"
    assert cfg.auth.mode == "token"
    assert cfg.storage.retention_days == 30

def test_helper_parsers():
    assert _as_bool("true") is True
    assert _as_bool("yes") is True
    assert _as_bool("0") is False
    assert _as_bool(None, default=True) is True
    assert _as_int("42", 10) == 42
    assert _as_int("invalid", 10) == 10

def test_gitops_basics():
    assert git_available() is True
    res = GitResult(0, "success", "")
    assert res.ok is True
    res_err = GitResult(1, "", "error")
    assert res_err.ok is False
    assert is_git_repo(Path(".")) is True
