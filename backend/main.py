"""Flight Scanner — FastAPI app.

Serves the JSON API and, in production, the built React frontend from the same
process so the whole app runs on a single port inside one container.
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from routes import airlines, airports, destination, search

app = FastAPI(title="Flight Scanner", version="1.0.0")

# CORS so the Vite dev server (:5173) can call the API during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(airports.router)
app.include_router(airlines.router)
app.include_router(destination.router)


@app.get("/api/health")
def health():
    return {"ok": True, "mock": os.environ.get("FLIGHT_SCANNER_MOCK", "") in ("1", "true", "yes")}


# --- Serve the built frontend (if present) ---------------------------------- #
_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
_FRONTEND_DIST = os.path.abspath(_FRONTEND_DIST)


def _safe_static_file(full_path: str) -> str | None:
    """Resolve a request path to a file *inside* the dist dir, or None.

    Uvicorn does not collapse "../" in the raw request path, so without this a
    crafted request (e.g. GET /../../backend/main.py or /etc/passwd) could read
    arbitrary files the process can access. We realpath and confirm containment.
    """
    if not full_path:
        return None
    candidate = os.path.realpath(os.path.join(_FRONTEND_DIST, full_path))
    inside = candidate == _FRONTEND_DIST or candidate.startswith(_FRONTEND_DIST + os.sep)
    if inside and os.path.isfile(candidate):
        return candidate
    return None


if os.path.isdir(_FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")), name="assets")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))

    _INDEX_HTML = os.path.join(_FRONTEND_DIST, "index.html")

    # SPA fallback: any non-API, non-asset path returns index.html.
    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        safe = _safe_static_file(full_path)
        if safe:
            return FileResponse(safe)
        return FileResponse(_INDEX_HTML)
