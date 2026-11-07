"""Throwaway server: mount the plugin router on a bare FastAPI app so the routes
can be curled without the desktop session cookie (the real mount is auth-gated).

    python3 tests/serve_api.py 8899      # then curl 127.0.0.1:8899/health
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "dashboard"))

from fastapi import FastAPI  # noqa: E402
import plugin_api  # noqa: E402

app = FastAPI(title="hermes-notebook routes (throwaway)")
app.include_router(plugin_api.router, prefix="/api/plugins/hermes-notebook")

if __name__ == "__main__":
    import uvicorn
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
