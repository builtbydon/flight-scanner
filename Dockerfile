# ---- Stage 1: build the React SPA (Vite) ----
# Tailwind v4's native engine (@tailwindcss/oxide) makes npm's reify hang on some
# hosts, so we build with pnpm (via corepack). The shared component library is
# vendored under frontend/vendor/pandora-components (a git submodule) and consumed
# as a file: dependency, so the web build needs no GitHub auth.
FROM node:22-slim AS frontend
RUN corepack enable
WORKDIR /app/frontend
# Copy the whole frontend (incl. the vendored submodule) so the file: dep resolves.
COPY frontend/ ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile && pnpm build

# ---- Stage 2: Python backend that also serves the built frontend ----
FROM python:3.11-slim AS app
WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
# Built static assets land where backend/main.py expects them (../frontend/dist).
COPY --from=frontend /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
EXPOSE 8000
# FLIGHT_SCANNER_MOCK=1 forces demo data; unset/0 attempts live Google Flights.
ENV FLIGHT_SCANNER_MOCK=0
# --proxy-headers + --forwarded-allow-ips=* so redirects honor X-Forwarded-Proto
# when fronted by `tailscale serve` (HTTPS), avoiding http:// redirects to a TLS port.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
