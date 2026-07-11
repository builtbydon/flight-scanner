# CLAUDE.md — Flight Scanner architecture

> **Canonical URL = Tailscale, never localhost.** This app's address is always its
> `tailscale serve` HTTPS URL (`https://<host>.<tailnet>.ts.net:<port>/`), also
> registered as the Pandora "Open UI" URL. The local hot-reload dev servers (Vite
> `:5173`, uvicorn `:8000`, etc.) are for iteration ONLY — never present a raw
> `localhost`/`127.0.0.1`/dev-server URL as the app's address or as "done". Before
> saying done, bring the app up on its hosted path (docker compose + `tailscale
> serve`), confirm the health check, and report ONLY the Tailscale URL.

Guidance for AI agents (and humans) working in this repo. Keep this file, the
README, and the GitHub repo updated when major changes happen.

## Agent Preflight

Before editing, read this file and the relevant runtime/test config you will
touch. Do not rely on remembered commands.

- Canonical instruction path: `CLAUDE.md` (top-level `AGENTS.md` points here).
- Canonical hosted runtime: Docker Compose builds one image and serves the
  FastAPI API plus built React SPA on `127.0.0.1:8420` via container port `8000`
  by default.
- Health check: `http://127.0.0.1:8420/api/health`.
- Public URL: `https://<host>.<tailnet>.ts.net:8420/` for the configured
  Tailscale host/tailnet; keep the real value in local/private runtime config.
- Required full verification command: `./scripts/test.sh`.
- Local hot-reload development path: `./scripts/dev.sh` starts FastAPI on `:8000`
  and Vite on `:5173`; open `http://localhost:5173`.
- Do not use alternate dev servers, ports, launch paths, or public exposure
  mechanisms unless the user explicitly asks.

## Runtime Rule

This is a hosted app. The production-like runtime is `docker compose up -d --build`
from the repo root, bound to `127.0.0.1:8420` by default and exposed tailnet-only
with `tailscale serve --bg --https=8420 localhost:8420`. Keep the hosted app on
port `8420` and do not bind it to `0.0.0.0`. Public/local users can override the
host port with `FLIGHT_SCANNER_PORT` when `8420` is occupied. The container restart policy is
`unless-stopped`.

Agents should not relaunch the hosted app for documentation-only changes. When a
runtime change needs verification, use the canonical hosted path above and check
`/api/health`.

## Test Selection and Definition of Done

Classify every change by the surface it touches, then run or add the matching
tests:

- Logic/data changes: add or update focused unit tests in `backend/tests/` or
  `frontend/src/**/*.test.tsx`; run the relevant test command.
- API/backend changes: cover route/service behavior with pytest in
  `backend/tests/`, using `FLIGHT_SCANNER_MOCK=1` for deterministic tests.
- UI layout/rendering changes: run or add Vitest component coverage when useful,
  and run Playwright browser checks at desktop and mobile widths.
- Navigation/routing changes: verify SPA fallback/deep links and browser
  navigation with Playwright where practical.
- Deployment/runtime changes: verify Docker Compose/build behavior and
  `http://127.0.0.1:8420/api/health` or the test container health path.

Bug fixes need a regression test that would have failed before the fix. UI
layout/navigation changes need real browser checks at desktop and mobile widths,
with overflow, clipping, and interaction assertions where practical. The
definition of done is: code/docs updated, relevant regression coverage added or
explained, matching verification commands run, and any skipped checks reported
with exact commands and the reason they were skipped.

## Privacy and Secrets

Never commit confidential or user-identifying data, including real names,
emails, account identifiers, tokens, API keys, local absolute paths, private
hostnames, tailnet names, account IDs, customer/user data, or anything that ties
the code to a specific private person or account. Use environment variables,
ignored local config, or documented placeholders instead. Before saying done,
inspect newly added config, docs, fixtures, screenshots, logs, and test data for
accidental personal or secret material.

Chosen history privacy policy: keep using the scrubbed public-mirror publishing
path. Private repository history may contain old local runtime identifiers, so
do not make this private repository public directly. If direct public release of
the private repository is ever required, stop and first rewrite private history
with `git-filter-repo`/BFG, then re-run privacy validation before publishing.

Repository-file inspection policy: run privacy/release inspection from a real
Git checkout for the private repository so `git ls-files` is authoritative. A
Git-less filesystem scan is acceptable only for the already-scrubbed public
mirror/export path, where history is intentionally absent and ignored local
artifacts are not part of the publishing source.

## What this app is

A personal, free, visual flight-search tool. The user searches a route/date, gets
live Google Flights results, and explores a selected itinerary on a **3D globe**
(animated plane along great-circle arcs and layovers) with deep links to book.
No accounts, no database, no paid APIs.

## High-level shape

Single Docker image, single process, **one port**:

- A **FastAPI** backend serves the JSON API *and* the built React SPA from the
  same Uvicorn process.
- A **React 19 + Vite + TypeScript + Tailwind v4** frontend (built with **pnpm**)
  renders the UI from the shared **house design system** — `pandora-components-web`
  (vendored as a git submodule under `frontend/vendor/pandora-components`, consumed
  via a `file:` dep) plus the `--pb-*` design tokens. The 3D globe is
  `react-globe.gl` (Three.js/WebGL).
- Multi-stage `Dockerfile`: stage 1 builds the frontend (`pnpm build` →
  `frontend/dist`), stage 2 is the Python image that copies that build in and
  serves it. `docker-compose.yml` runs it bound to `127.0.0.1:8420` by default,
  with `FLIGHT_SCANNER_PORT` available for local/public port conflicts.

```
Browser ──HTTPS──> tailscale serve (:8420) ──> 127.0.0.1:8420 ──> container :8000
                                                                    │
                                          FastAPI (main.py) ────────┤
                                            ├── /api/*  JSON
                                            └── /        built React SPA (dist)
```

## Backend (`backend/`)

- `main.py` — FastAPI app. Mounts routers, enables CORS (for local Vite dev), adds
  `/api/health`, and serves `frontend/dist` (static assets + SPA fallback) when it
  exists. Run with `--proxy-headers --forwarded-allow-ips=*` (see Dockerfile) so
  redirects work behind `tailscale serve`'s HTTPS.
- `routes/`
  - `search.py` — `POST /api/search` (Pydantic `SearchRequest`), TTL-cached.
  - `airports.py` — `GET /api/airports?q=` autocomplete.
  - `airlines.py` — `GET /api/airlines/{iata}` curated airline experience card
    (legroom, bag fees, snacks, Wi-Fi, seat power); 404 for unknown codes.
  - `destination.py` — `GET /api/destination/{iata}` destination context.
- `services/`
  - `flights.py` — **the core**. Two paths:
    - **Live**: builds the same `tfs` query as `fast-flights`, fetches Google
      Flights HTML directly (`fetch_mode="common"`, avoiding the broken hosted
      Turnstile proxy), and parses each row's **aria-label** to extract price,
      airlines, stops, **start/end clock times**, and **exact layover airports +
      durations**. Layover airport *names* are resolved to IATA/coords via
      `airports.match`. Per-leg flight times are estimated by distance (Google
      only gives the total). Includes retry + bad-layout detection and per-result
      `tfs` booking deep links. Helpers are factored (`_fetch_html`,
      `_results_from_html`, `_parse_label`) so the **return direction** can be
      scraped too: for round trips, `_scrape_return` does a one-way DEST→ORIGIN
      scrape on the return date and attaches a representative `returnItinerary`
      (route/times/layovers only — Google bundles round-trip pricing, so no
      separate return price).
    - **Mock**: full-detail synthetic itineraries (multi-leg, layovers, aircraft,
      **real departure/arrival clock times** via `_clock`, and a `returnItinerary`
      for round trips) used when `FLIGHT_SCANNER_MOCK=1` or as an automatic
      graceful fallback when the scrape fails. The app never crashes.
  - `airports.py` — loads the bundled OpenFlights `airports.dat`; provides
    `get(iata)`, `search(q)` (autocomplete) and `match(name, city)` (name→IATA for
    layover resolution: exact normalized name → distinctive-token subset → city).
  - `cache.py` — in-memory `TTLCache` for identical searches.
- `data/` — `airports.dat` (OpenFlights, ~7k airports) and `airlines.json`
  (internal airline-name/code catalog used for normalization and mock data).

## Frontend (`frontend/src/`)

- `App.tsx` — full-width responsive layout: left column = search + results list,
  right column = globe + selected-itinerary detail + booking links. Stacks on
  mobile.
- `api.ts` — typed client + response/result types.
- **Shared house components** (`pandora-components-web`): `PageShell`, `Card`,
  `Button`, `Badge`, `Spinner`, `EmptyState`, `TextField`/`SelectField`,
  `ToastProvider`/`useToast`. Wired in `main.tsx`; tokens bridged in `index.css`
  (`@import "pandora-components-web/theme.css"` + `@source` the vendored src).
- `components/shared/` — **generic, token-only, promotion-candidate** components
  (declared in `components.json` `provides[]`): `DatePicker` (typeable input +
  portal calendar), `SegmentedControl` (pill toggle), `Autocomplete` (debounced
  async combobox). Keep these app-agnostic so they can be lifted into the shared
  repo. `AirportAutocomplete` is a thin app wrapper over `Autocomplete`.
- `components/`
  - `SearchForm.tsx` — trip toggle, airport autocomplete, `DateField`s, cabin, pax.
  - `AirportAutocomplete.tsx` — debounced `/api/airports` lookup.
  - `DateField.tsx` — typeable input + **portal** popup calendar (renders at
    `document.body`, z-9999, so it sits above the WebGL globe); blocks past dates.
  - `ResultsList.tsx` — sortable results with `DealBadge`.
  - `components/shared/GeoGlobe.tsx` — **generic, data-driven** `react-globe.gl`
    globe (promotion-candidate to merge into the shared `ui.geo-globe`): renders
    `{ points, arcs }` with an optional craft marker **animated along each arc**
    (great-circle interp + `getCoords`; antimeridian-safe framing). ZERO domain
    coupling. `lib/globeData.ts` maps a `FlightResult` (+ return) into the
    outbound (sky) / return (amber) arcs + points it consumes.
  - `LegTimeline.tsx` — overall **Departs/Arrives** clock times header, then
    per-leg times, aircraft, layover airports + durations.
  - `DealBadge.tsx` — low/typical/high chip.
- `lib/booking.ts` — Google Flights + Kayak deep-link builders (fallbacks; live
  results carry exact `tfs` booking URLs from the backend).
- `public/` — bundled earth textures for the globe (no external tile dependency).

## Tests (`backend/tests/`, `frontend/tests/`)

- **Unit** (`backend/tests/test_unit_*.py`) — pure logic in `services/`
  (airport search/match, duration/price parsing, aria-label parsing, deal levels,
  booking URLs).
- **Integration** (`backend/tests/test_integration_api.py`) — FastAPI `TestClient`
  over the real routes in `FLIGHT_SCANNER_MOCK=1` mode (no network).
- **UI** (`frontend/tests/*.spec.ts`) — Playwright against a running mock-mode
  container: search flow, globe canvas + animated plane, calendar above globe,
  past-date blocking, booking links.

Run: `backend/tests` via `pytest`; UI via `npx playwright test` (needs the app
running, e.g. mock container on `:8422`).

## Hosting

Docker, bound to `127.0.0.1:8420`, exposed tailnet-only over HTTPS via
`tailscale serve --bg --https=8420 localhost:8420`. Reachable at
`https://<host>.<tailnet>.ts.net:8420/`. Port 8420 is recorded in
`~/projects/PORTS.md` — **do not change it**.

## Conventions / gotchas

- Free only: no paid APIs, no keys. The one env var is `FLIGHT_SCANNER_MOCK`.
- Scraping is fragile by nature — all of it is isolated in `services/flights.py`
  behind the mock fallback, so the UI never breaks.
- The globe is WebGL; anything that must visually overlay it (popovers) must use a
  portal + high z-index, not just `z-index` inside the form's stacking context.
- `window.__fsPlanes` is a test observability hook exposing the plane meshes.

<!-- cross-project-testing-enforcement:start -->
## Cross-Project Testing Enforcement

When changing code, tests must prove the final user-visible behavior, not just
that a page, list, API route, or broad section loaded. Classify the touched
surface first, then cover the matching seams: unit tests for pure logic,
integration/API tests for contracts and transforms, browser/UI tests for
user-visible flows, and runtime smoke tests for deployed artifacts.

For external, scraped, provider-backed, or cached data, include messy
provider-shaped fixtures: short labels, aliases, missing IDs/codes, stale cache,
partial payloads, malformed rows, duplicate records, nullable fields, and
unexpected but real-world field shapes. Provider-backed fields that are
persisted or cached must be tested at the cache/serialization/export boundary,
not only at the initial parser boundary, so stale cached payloads still prove
final API/UI/export output is sanitized and user-visible.

UI/E2E tests must wait for dependent async data to settle and then assert
specific final content or state, such as a populated card, recommendation,
action link, detail panel, error message, recovery state, completed async
section, or final outbound API/action payload created from the rendered provider
result. A visible shell, broad container selector, or "page loaded" assertion is
not enough. For frontend changes, verify either a fresh built/served artifact
that contains the changed source or explicitly report the failed build or stale
artifact blocker; stale-hosted browser results do not count as deployed-artifact
verification.

Visual or layout changes need desktop and mobile browser checks or equivalent
overflow, clipping, occlusion, scroll, and interaction assertions. Date-sensitive
UI tests must pin time or deliberately navigate to a deterministic date range;
do not rely on the current calendar month/day producing the needed state.

Verification infrastructure is part of the contract. Required commands must use
bounded timeouts or bounded runner canaries for pytest/TestClient, jsdom/Vitest,
Playwright webServer, local runtime health, and deployed health checks. If a
runner, fixture, webServer, or runtime cannot start and answer a minimal
health/canary check inside the bound, track that as a blocking test-infra
failure with the exact command and phase. Do not bury it under feature-test
results or replace it with a weaker smoke test.

Bug fixes need a regression test that would have failed before the fix. If a
required behavior-level check cannot run, report the exact command and blocker,
the smallest isolated command that reproduces it, and whether the block happens
before the test body, inside a fixture/runner, in the browser webServer, or in
the deployed artifact.
<!-- cross-project-testing-enforcement:end -->
