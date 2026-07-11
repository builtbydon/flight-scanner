# Flight Scanner 🛫🌍

A fast, **visual** flight search tool. Search like Google Flights, then watch your
itinerary fly across an interactive **3D globe** — each leg drawn as a realistic
great-circle arc with a little plane animating along it, every layover and
aircraft labelled. When you like one, jump straight to **Google Flights or
Kayak** to book it.

Personal tool: no accounts, no tracking, completely free.

**TL;DR for a new user:** install Docker, then `docker compose up -d --build` and
open **http://localhost:8420** for local-only use. That's the whole setup — no
accounts, no API keys, no config files to edit. Full walkthrough below.

This app can also be exposed tailnet-only over HTTPS at
**https://<host>.<tailnet>.ts.net:8420/** when `tailscale serve` is configured
locally; keep the real hostname/tailnet out of committed docs. Port **8420** is
the default local endpoint for this app, and can be overridden if that port is
already taken.

For launch signoff, report the Tailscale HTTPS URL, not the localhost URL:
`https://<host>.<tailnet>.ts.net:8420/`.

> Full spec in [`SPEC.md`](./SPEC.md).

---

## ✨ Features

- **Snappy search** — origin/destination, one-way or round-trip, cabin (economy
  default), passengers. Sort results by best / cheapest / fastest. Every result
  shows its **departure → arrival times** (with a +1 day marker for overnights).
- **Round-trip returns** — the return flight is fetched too: its route, times and
  layovers appear in the description and are drawn on the globe in **amber**
  alongside the sky-blue outbound.
- **Worldwide airport autocomplete** — type an IATA code, city, or airport name;
  matches appear instantly (bundled OpenFlights dataset, ~7,000 airports).
- **3D globe itinerary view** 🌍
  - Each flight leg is a **true great-circle arc** (the curved path planes
    actually fly), lifted off the surface and glowing.
  - A **3D plane animates along each arc**, oriented in its direction of travel
    and looping — longer legs fly proportionally slower.
  - Airports shown as colored dots with labels: 🟢 origin, 🟡 layover, 🔴 destination.
  - The camera flies to frame your route (correct even for trans-Pacific routes)
    and gently auto-rotates when idle.
- **Google-Flights-style date picker** 📅
  - **Type** a date (`2026-09-10`, `9/10`, `09/10/2026`) — it auto-formats.
  - Or click 📅 for a **popup month calendar**.
  - **Past dates are blocked**; the return date can't precede departure.
- **"Is this a good deal?"** — a low / typical / high chip on every result, from
  Google Flights' own price signal when available, with a relative
  cheapest/median fallback so there's always a verdict.
- **Book it** 🔗 — one click opens **Google Flights** or **Kayak** with your
  route, dates, cabin, and passengers pre-filled.
- **Responsive** — works on mobile and desktop.

---

## ✅ Requirements

- **Docker** + **Docker Compose** — Docker Desktop on macOS/Windows, or `docker`
  with the compose plugin on Linux. That's the only requirement.
- **No** Python, Node, API keys, accounts, or paid services. Nothing to sign up for.
- **Internet access for live mode** — live flight search and destination context
  make outbound HTTPS requests to free public services. Use
  `FLIGHT_SCANNER_MOCK=1` for deterministic offline demo flight data.
- *(Optional)* **Tailscale**, only if you want to reach the app from your other
  devices instead of just `localhost`.

## 🚀 Setup (the whole thing — for anyone)

The app is **zero-config**: it ships with working defaults and needs no secrets.
From a clone of this repo:

```bash
# 1. Build & start (first build ~2–3 min)
docker compose up -d --build

# 2. Open it for local-only use
#    → http://localhost:8420
#    Search a route + date, then click a result to see the 3D globe + details.
```

That's it — there is no setup wizard because there is nothing to configure.
After the image is built, container startup is self-contained: it does not
install packages or fetch extra assets just to boot. In default live mode,
runtime requests can still go out over HTTPS when a user searches flights
(Google Flights) or opens destination context (Wikivoyage, Nominatim, and
Wikipedia). Set `FLIGHT_SCANNER_MOCK=1` for deterministic offline demo flight
data; destination context remains best-effort and may be unavailable without
network access.

- **Stop:** `docker compose down`  ·  **Logs:** `docker compose logs -f`
- It auto-restarts (`restart: unless-stopped`) until you stop it.
- If port `8420` is already in use, choose another localhost port:
  `FLIGHT_SCANNER_PORT=8423 docker compose up -d --build`, then open
  `http://localhost:8423`.
- **First run:** the empty globe view says *"Search a route, then pick a flight…"* —
  just run a search. If live Google Flights is rate-limiting you, the app shows a
  small notice and falls back to full demo data (it never errors out).

### Reach it from your other devices (optional — Tailscale)

`docker-compose.yml` binds the app to `127.0.0.1` only, so it isn't on your LAN or
the internet. To reach it from other devices on **your** tailnet over HTTPS:

```bash
# one-time, on the host running the container:
tailscale serve --bg --https=8420 localhost:8420
```

Then open `https://<host>.<tailnet>.ts.net:8420/`. Do **not** change the bind to
`0.0.0.0` — let `tailscale serve` be the only thing that exposes it.

For hosted launch signoff, this Tailscale HTTPS URL is the canonical app URL to
verify and report. `http://localhost:8420` is only the local container endpoint
behind that hosted path.

## ⚙️ Configuration (optional)

There are **no required settings**. Optional settings can be passed as
environment variables or placed in a local `.env` file copied from
`.env.example`:

| Setting | Default | Behavior |
|---|---|
| `FLIGHT_SCANNER_MOCK` | `0` | Live Google Flights; auto-falls back to demo data if blocked. Set to `1` for full-detail demo data. |
| `FLIGHT_SCANNER_BIND_ADDR` | `127.0.0.1` | Local bind address. Keep this on localhost unless you know you want LAN exposure. |
| `FLIGHT_SCANNER_PORT` | `8420` | Local host port. Change this if another app already uses `8420`. |

```bash
# e.g. run in guaranteed-offline demo mode:
FLIGHT_SCANNER_MOCK=1 docker compose up -d --force-recreate

# e.g. run on a different localhost port:
FLIGHT_SCANNER_PORT=8423 docker compose up -d --build
```

### Run it for local development (hot reload)

```bash
./scripts/dev.sh          # backend :8000 + frontend :5173, then open :5173
```

Or manually:

```bash
# backend
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend (another terminal)
cd frontend && pnpm install && pnpm run dev
```

---

## 🗂️ Data sources (all free)

- **Flights** — live **Google Flights** via the `fast-flights` scraper. Real
  prices/schedules, no API key. It's *unofficial*, so it can be rate-limited or
  break if Google changes things; when that happens the app **automatically
  falls back to detailed demo data** and shows a notice — it never crashes.
- **Airports** — the free worldwide **OpenFlights** dataset (bundled), used for
  autocomplete and for the globe's coordinates.
- **Airline catalog** — bundled airline names and codes used internally to
  normalize provider labels and generate realistic demo itineraries.
- **Destination context** — Wikivoyage summaries, Nominatim geocoding, and
  Wikipedia nearby-place search. These are best-effort public HTTPS calls; if
  they fail, the core flight search and globe still work.

### Live vs. mock

Live results are parsed from Google Flights' per-row **accessibility labels**,
which include each **layover airport and its exact duration** — so live
itineraries draw the full multi-leg route on the globe (e.g. SEA → JFK → LHR)
with layovers labelled. Per-leg *flight* times are estimated from distance
(Google only publishes the total), and aircraft type isn't provided. **Demo/mock
mode** generates fully-detailed itineraries so you can see everything — globe,
layovers, aircraft, animated plane, deal badges — working end to end offline.
Toggle it with `FLIGHT_SCANNER_MOCK` (see the **Configuration** section above).

---

## ✅ Tests

```bash
./scripts/test.sh          # backend (pytest) + frontend (Playwright), all-in-one
```

- **Unit + integration** (`backend/tests/`, pytest): service logic (airport
  search/match, aria-label parsing, deal levels, booking URLs) and the FastAPI
  routes via `TestClient` in mock mode (no network).
- **UI** (`frontend/tests/ui.spec.ts`, Playwright, desktop + mobile): load, search
  flow, 3D globe + animated plane, layover details, booking link, past-date
  blocking, calendar-above-globe, and mobile layout (no horizontal overflow).

Backend only: `cd backend && pip install -r requirements-dev.txt && FLIGHT_SCANNER_MOCK=1 pytest tests -q`.

---

## 🛠️ Tech stack

| Layer        | Choice |
|--------------|--------|
| Backend      | Python · **FastAPI** · `uvicorn` |
| Flight data  | **`fast-flights`** (Google Flights scraper) |
| Cache        | in-memory TTL (`cachetools`) — snappy repeat searches |
| Frontend     | **React 19 + Vite + TypeScript** (built with **pnpm**) |
| Design system | **`pandora-components-web`** (vendored submodule) + `--pb-*` tokens — the shared house UI library |
| 3D globe     | **`react-globe.gl`** + **Three.js** (WebGL); earth textures bundled locally |
| Styling      | **Tailwind CSS** |
| Static data  | OpenFlights `airports.dat`, airline-name catalog |
| Packaging    | **Docker** — single multi-stage image, default local port (`8420`) |

No database. No paid services. No secrets/keys required to run.

### Privacy and publishing

Do not commit real Tailscale hostnames, tailnet names, local absolute paths,
account identifiers, or other private runtime details. Use placeholders in docs
and keep real deployment values in local/private config.

Chosen history privacy policy: keep using the scrubbed public-mirror publishing
path. Private repository history may contain old local runtime identifiers, so
do not make this private repository public directly. If direct public release of
the private repository is ever required, stop and first rewrite private history
with `git-filter-repo`/BFG, then re-run privacy validation before publishing.

Repository-file inspection policy: private/release checks should run from a real
Git checkout so `git ls-files` is authoritative. Filesystem-based inspection is
accepted only for the scrubbed public mirror/export path, where `.git` history is
intentionally absent and ignored local artifacts are not part of the publishing
source.

---

## 📁 Project layout

```
backend/
  main.py                 FastAPI app; also serves the built frontend
  routes/                 /api/search, /api/airports, /api/destination/{iata}
  services/               flights (scraper + mock), airports, cache
  data/                   airports.dat (OpenFlights), airline catalog
frontend/
  src/
    App.tsx               layout: search + results + globe + detail
    api.ts                typed backend client
    components/
      SearchForm.tsx      trip toggle, autocomplete, dates, cabin
      AirportAutocomplete.tsx
      ResultsList.tsx     sortable results with deal badges
      LegTimeline.tsx     per-leg times, aircraft, layovers
      DestinationPanel.tsx Wikivoyage + nearby attractions
      shared/              reusable date picker, range picker, autocomplete, toggles
    lib/booking.ts        Google Flights + Kayak deep links
    lib/globeData.ts      maps itineraries into shared GeoGlobe data
  public/                 bundled earth textures
Dockerfile, docker-compose.yml   one-container packaging
```

---

## ⚠️ Notes & limitations

- **Scraper fragility**: `fast-flights` depends on Google Flights' internal
  format; it's isolated in `backend/services/flights.py` so it can be patched
  without touching the rest of the app, and it degrades gracefully to demo data.
- **Per-leg detail on live data**: layover airports and durations are real
  (parsed from Google's accessibility labels), but per-leg flight times are
  estimated from distance and aircraft type isn't available on live data.
- **Not for booking transactions**: Flight Scanner doesn't sell tickets; the
  Book buttons hand you off to Google Flights / Kayak to complete the purchase.

## Support this work

This tool is free and open. If it earns a place in your routine and you want to help keep it growing, you can back the work directly.

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-f59e0b?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/builtbydon)
