#!/usr/bin/env bash
# Run the full test suite: backend unit + integration (pytest) and frontend
# Playwright UI tests (against a throwaway mock-mode container).
set -euo pipefail
cd "$(dirname "$0")/.."

TIMEOUT_BIN="${TIMEOUT_BIN:-timeout}"
if command -v corepack >/dev/null 2>&1; then
  PNPM_CMD=(corepack pnpm)
else
  PNPM_CMD=(pnpm)
fi

run_bounded() {
  local seconds="$1"
  local phase="$2"
  shift 2
  echo "==> ${phase} (${seconds}s timeout)"
  set +e
  "${TIMEOUT_BIN}" "${seconds}s" "$@"
  local code=$?
  set -e
  if [ "$code" -ne 0 ]; then
    echo "BLOCKED: ${phase} failed or exceeded ${seconds}s." >&2
    return "$code"
  fi
}

frontend_source_hash() {
  (
    cd frontend
    node --input-type=module -e '
      import { createHash } from "node:crypto";
      import { readdirSync, readFileSync, statSync } from "node:fs";
      import { join, relative } from "node:path";
      const root = join(process.cwd(), "src");
      const files = [];
      const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
          const path = join(dir, entry);
          const stat = statSync(path);
          if (stat.isDirectory()) walk(path);
          else if (/\.(css|ts|tsx)$/.test(entry)) files.push(path);
        }
      };
      walk(root);
      const hash = createHash("sha256");
      for (const file of files.sort()) {
        hash.update(relative(process.cwd(), file));
        hash.update("\0");
        hash.update(readFileSync(file));
        hash.update("\0");
      }
      console.log(hash.digest("hex").slice(0, 16));
    '
  )
}

echo "==> Backend dependency setup"
(
  cd backend
  [ -d .venv ] || python3 -m venv .venv
  . .venv/bin/activate
  run_bounded 180 "backend dependency install" pip install -q -r requirements-dev.txt
  run_bounded 20 "pytest/TestClient health canary" env FLIGHT_SCANNER_MOCK=1 python -m pytest tests/test_integration_api.py::test_health -q
  run_bounded 180 "backend unit + integration tests (pytest, mock mode)" env FLIGHT_SCANNER_MOCK=1 python -m pytest tests -q
)

echo "==> Frontend dependency setup"
(
  cd frontend
  [ -d node_modules/@playwright/test ] || run_bounded 180 "frontend dependency install" "${PNPM_CMD[@]}" install --frozen-lockfile
  run_bounded 20 "jsdom/Vitest canary" "${PNPM_CMD[@]}" exec vitest run src/test/jsdom-canary.test.ts
  run_bounded 180 "frontend component tests (Vitest/jsdom)" "${PNPM_CMD[@]}" test
)

EXPECTED_SOURCE_HASH="$(frontend_source_hash)"
export EXPECTED_SOURCE_HASH

run_bounded 60 "Docker ignore env-file policy canary" ./scripts/check-dockerignore-env.sh
run_bounded 240 "fresh Docker artifact build" docker build -t flight-scanner .
docker rm -f fs-test >/dev/null 2>&1 || true
run_bounded 30 "Playwright webServer container start" docker run -d --name fs-test -e FLIGHT_SCANNER_MOCK=1 -p 8422:8000 flight-scanner
trap 'docker rm -f fs-test >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8422/api/health >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 1
done
if [ "${healthy:-0}" != "1" ]; then
  echo "BLOCKED: local runtime health did not answer http://localhost:8422/api/health within 30s." >&2
  docker logs fs-test >&2 || true
  exit 1
fi
run_bounded 10 "local runtime health canary" curl -sf http://localhost:8422/api/health

echo "==> Frontend Playwright UI tests (desktop + mobile)"
(
  cd frontend
  run_bounded 180 "Playwright browser UI tests against fresh artifact" env BASE_URL=http://localhost:8422 EXPECTED_SOURCE_HASH="${EXPECTED_SOURCE_HASH}" "${PNPM_CMD[@]}" exec playwright test --config=playwright.config.ts
)

echo "==> All tests passed."
