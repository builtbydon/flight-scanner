# Flight Scanner — Specification

## Overview

Flight Scanner is a fast, visual, responsive web app for searching flights and
understanding the route behind each itinerary. It is a personal tool — no
accounts, no login, just scanning.

It focuses on what Google Flights does not show clearly:

1. **Visualizes an itinerary on a 3D globe** — pick a result and see the
   great-circle flight path drawn leg by leg, with an animated plane, each
   flight's duration, and each layover's airport and wait time.
2. **Keeps booking handoff simple** — selected itineraries include Google
   Flights and Kayak links with route, dates, cabin, and passenger count
   prefilled where possible.

The design priority is **snappiness** — it should feel as quick and frictionless
as Google Flights.

### Data sources (the key constraint: real data, $0)

- **Flight results:** scraped live from **Google Flights** using the same query
  shape as `fast-flights`, with direct HTML parsing for itinerary labels. Real
  prices/schedules, no API key, no signup, free.
  - ⚠️ This is an *unofficial* source. It can break without warning if Google
    changes their internal format, and it is a ToS gray area — acceptable for a
    personal, non-commercial tool only. Mitigated with caching + graceful
    fallback to full-detail demo data, never a crash.
- **Airport coordinates** (for the globe): the free, global **OpenFlights
  `airports.dat`** dataset, bundled at build time. Covers worldwide airports.
- **Airline names/codes:** a bundled static catalog used internally to normalize
  provider labels and generate realistic demo itineraries.

## Features

### v1 (this build)
- **Search form:** origin, destination, depart date, optional return date
  (one-way / round-trip toggle), passenger count. Cabin defaults to **economy**
  with a toggle for premium economy / business.
- **Airport autocomplete:** debounced search over the bundled airport dataset
  (by IATA code, city, or airport name) so origin/destination entry is instant.
- **Results list:** snappy, sortable list — price, total duration, stops,
  airlines, departure/arrival times. Sort by cheapest / fastest / best.
- **"Is this a good deal?" indicator:** each result (and the detail view) shows a
  deal verdict — **low / typical / high** — sourced two ways:
  - Google Flights' own **price-level assessment**, surfaced via `fast-flights`'
    `current_price` field when present (this is the same "prices are currently
    low/typical/high" signal Google shows).
  - A **relative badge** computed across the current result set ("cheapest",
    "below median", "above median") so there's always a verdict even when
    Google's signal is missing. Shown as a colored chip (green/amber/red).
- **Itinerary globe (the headline feature):** selecting a result opens a detail
  view with:
  - a WebGL 3D globe drawing each leg as a great-circle arc between airports,
  - a small plane animating along each arc, oriented in the direction of travel,
  - route framing that handles long-haul and trans-Pacific itineraries,
  - per-leg labels: flight number, airline, flight time, **and aircraft type**
    (e.g. "Boeing 787-9") when the scraper provides it, else "Aircraft: n/a",
  - per-layover labels: airport + layover duration (with a warning flag for
    very short or very long layovers).
- **Responsive UI:** works well on both mobile and desktop (results list +
  globe reflow to a stacked layout on small screens).
- **Caching:** identical searches within a TTL window return instantly from a
  server-side cache.
- **Booking handoff:** selected itineraries include Google Flights and Kayak deep
  links with route, dates, cabin, and passenger count prefilled where possible.

> Note: aircraft type and Google's price-level signal are surfaced **when the
> scraper returns them** — both can be absent for some routes/flights, in which
> case the app falls back gracefully (aircraft → "n/a"; deal → relative badge).

### Explicitly out of scope for v1
- Booking transactions and payments. Flight Scanner hands off to Google Flights
  or Kayak for purchase.
- Multi-city itineraries (one-way + round-trip only).
- User accounts, saved searches, price alerts.
- Perfectly modeling every fare class's baggage rules — the curated data is
  economy-focused, US-domestic-centric for fees, with notes for international.

## Tech stack

| Layer        | Choice | Why |
|--------------|--------|-----|
| Backend      | **Python 3.11+ / FastAPI** | Small, fast API surface with a Python scraper/parser layer. |
| Flight data  | **Google Flights HTML parser** | Free live Google Flights scraping, no key; uses `fast-flights`-compatible query data. |
| Frontend     | **React 19 + Vite + TypeScript** | Fast dev/build, snappy SPA. |
| Design system | **`pandora-components-web`** | Shared house components and `--pb-*` tokens. |
| 3D globe     | **`react-globe.gl` + Three.js** | WebGL globe, animated plane, bundled local earth textures. |
| Arcs         | Great-circle data mapped client-side from normalized itinerary legs. |
| Styling      | **Tailwind CSS** | Fast responsive layouts. |
| Server cache | In-memory TTL cache (e.g. `cachetools`) | Snappy repeat searches; no DB needed. |
| Static data  | OpenFlights `airports.dat`, airline-name catalog | Free, bundled. |
| Packaging    | **Docker** (single multi-stage image) | One container, one port, reproducible. |

No database. No external paid services. No secrets/keys required to run.

### Containerization
The whole app ships as **one Docker container on its own port**. A multi-stage
build (1) builds the React frontend with Node, then (2) copies the static build
into the Python image where **FastAPI serves both the API and the frontend** from
a single `uvicorn` process — so there's only one port to expose.

- Default host port: **`8420`** (mapped to the container's internal `8000`),
  overridable via an env var / compose. Chosen to avoid colliding with common
  dev ports.
- A `docker-compose.yml` is provided for one-command run.

## Architecture / key files

```
flight-scanner/
├── SPEC.md
├── README.md
├── Dockerfile                  # multi-stage: build frontend -> serve via FastAPI
├── .dockerignore
├── docker-compose.yml          # one-command run; maps host 8420 -> container 8000
├── backend/
│   ├── main.py                 # FastAPI app; serves API + built frontend
│   ├── routes/
│   │   ├── search.py           # POST /api/search -> Google Flights scraper, cached
│   │   ├── airports.py         # GET  /api/airports?q= -> autocomplete
│   │   └── destination.py      # GET  /api/destination/{iata} -> destination context
│   ├── services/
│   │   ├── flights.py          # Google Flights scraper/parser, normalize results
│   │   ├── airports.py         # load + index airports.dat (coords, search)
│   │   └── cache.py            # TTL cache for searches
│   ├── data/
│   │   ├── airports.dat        # OpenFlights worldwide airport dataset
│   │   └── airlines.json       # internal airline-name/code catalog
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts              # typed client for the backend
│   │   ├── components/
│   │   │   ├── SearchForm.tsx
│   │   │   ├── AirportAutocomplete.tsx
│   │   │   ├── ResultsList.tsx
│   │   │   ├── DestinationPanel.tsx     # destination context
│   │   │   ├── LegTimeline.tsx         # flight times, aircraft, layover waits
│   │   │   ├── DealBadge.tsx           # low/typical/high deal chip
│   │   │   └── shared/
│   │   │       ├── GeoGlobe.tsx         # react-globe.gl arcs + animated plane
│   │   │       ├── DatePicker.tsx       # typeable portal calendar
│   │   │       ├── DateRangePicker.tsx
│   │   │       ├── Autocomplete.tsx
│   │   │       └── SegmentedControl.tsx
│   │   └── lib/
│   │       ├── booking.ts               # Google Flights + Kayak deep links
│   │       └── globeData.ts             # itinerary -> globe points/arcs
│   ├── public/                          # bundled earth textures
│   ├── package.json
│   └── vite.config.ts
└── scripts/
    ├── dev.sh                  # run backend + frontend together
    └── test.sh                 # full bounded verification
```

**Data flow:** Frontend → `POST /api/search` → backend checks TTL cache →
on miss scrapes Google Flights → normalizes results (legs, airports, airlines,
durations, booking links) → returns JSON. Frontend renders the list; on
selection it maps legs into globe points/arcs, animates the plane, renders
destination context, and provides booking handoff links.

## How to run

### Docker (primary way to run)
```bash
docker compose up --build      # then open http://localhost:8420
# or without compose:
docker build -t flight-scanner .
docker run -p 127.0.0.1:8420:8000 flight-scanner
```
One container, one process, one port — no Python/Node setup needed on the host.
For hosted launch signoff, expose the local container through Tailscale and
report `https://<host>.<tailnet>.ts.net:8420/`, not the localhost URL.

### Local dev (hot reload)
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
corepack pnpm install
corepack pnpm run dev          # Vite dev server, proxies /api to :8000

# Or: ./scripts/dev.sh to run both. Open http://localhost:5173
```
Production: `corepack pnpm build` in `frontend/`, FastAPI serves the static build so
the whole app runs from a single `uvicorn` process.

## Acceptance criteria

1. Searching a valid route + date returns **real, current** flight results from
   Google Flights, typically within a couple seconds (instant on cache hit).
2. One-way and round-trip both work; economy is the default cabin.
3. Airport autocomplete returns matches as you type, for **worldwide** airports
   (IATA code, city, or name).
4. Selecting a result shows a 3D globe with a **great-circle arc per leg**, an
   animated plane, each leg labeled with its flight time **and aircraft type
   (when available)**, and each **layover labeled with airport + wait duration**
   (short/long layovers flagged).
4a. Each result shows a **deal verdict** (low/typical/high) from Google's price
   signal when present, falling back to a relative cheapest/median badge.
5. The layout is usable and clean on both **mobile and desktop** (stacked on
   small screens, side-by-side on wide screens).
6. Booking buttons hand the selected itinerary off to **Google Flights** and
   **Kayak**; Flight Scanner does not process transactions or payments.
7. When the scraper fails or returns nothing, the app shows a clear notice,
   falls back to full-detail demo data, and never crashes.
8. Runs entirely **free** — no API keys, no paid services, no login.
9. **`docker compose up --build` boots the whole app in a single container** and
   it's reachable at `http://localhost:8420` (its own port) — no host-side Python
   or Node install required.

## Known risks
- **Scraper fragility:** live scraping depends on Google Flights' internal
  format and may break; isolated behind `services/flights.py` so it can be
  swapped/patched without touching the rest of the app.
- **Rate limiting:** heavy scraping could get throttled; mitigated by caching
  and reasonable request pacing.
```
