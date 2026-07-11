#!/usr/bin/env bash
# Run backend (FastAPI :8000) and frontend (Vite :5173) together for local dev.
set -euo pipefail
cd "$(dirname "$0")/.."

# Backend
(
  cd backend
  [ -d .venv ] || python3 -m venv .venv
  . .venv/bin/activate
  pip install -q -r requirements.txt
  exec uvicorn main:app --reload --port 8000
) &
BACKEND_PID=$!

# Frontend
(
  cd frontend
  [ -d node_modules ] || pnpm install
  exec pnpm run dev
) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT
echo "Backend  -> http://localhost:8000"
echo "Frontend -> http://localhost:5173  (open this one)"
wait
