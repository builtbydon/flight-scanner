"""Flight search: live Google Flights via fast-flights, with a rich mock path.

fast-flights returns SUMMARY rows only (airline name, departure, arrival,
duration, stops, price) plus result.current_price (low/typical/high). It does
NOT expose per-leg layover airports or aircraft types. So:

  * Real path  -> normalize the summary; map is a single origin->dest arc with a
                  "N stops (airports not provided by source)" note.
  * Mock path  -> fully detailed multi-leg itineraries (layover airports,
                  aircraft, per-leg times) so every UI feature is exercised.

Mock is used when FLIGHT_SCANNER_MOCK=1, or automatically as a graceful
fallback whenever the live scrape errors or returns nothing.
"""
from __future__ import annotations

import base64
import json
import math
import os
import re
import time
import traceback
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional

from . import airports as airport_svc

_AIRLINES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "airlines.json")

# Overall wall-clock budget (seconds) for the live-fetch retry loop.
_FETCH_DEADLINE_S = 25.0


# --------------------------------------------------------------------------- #
#  Airline dataset + name->code reverse lookup
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def _airlines() -> dict:
    with open(os.path.abspath(_AIRLINES_PATH), encoding="utf-8") as fh:
        data = json.load(fh)
    data.pop("_meta", None)
    return data


def airline_card(code: str) -> Optional[dict]:
    """Curated economy/base-fare experience data (legroom, bag fees, snacks,
    Wi-Fi, seat power) for one airline, keyed by IATA code."""
    info = _airlines().get((code or "").upper())
    if not info:
        return None
    return {"code": code.upper(), **info}


@lru_cache(maxsize=1)
def _name_to_code() -> dict[str, str]:
    out = {}
    for code, info in _airlines().items():
        full = info["name"].lower()
        out[full] = code
        # without parenthetical: "Japan Airlines (JAL)" → "japan airlines"
        base = full.split(" (")[0].split(",")[0].strip()
        out[base] = code
        # without trailing generic word: "Frontier Airlines" → "frontier"
        for suffix in (" airlines", " airways", " air", " aviation", " express", " jet"):
            if base.endswith(suffix):
                out[base[: -len(suffix)].strip()] = code
                break
        # first word: "Delta Air Lines" → "delta"
        first = base.split()[0] if base.split() else ""
        if len(first) > 3:  # skip short words like "Air"
            out[first] = code
    return out


def _code_for_name(name: str) -> Optional[str]:
    if not name:
        return None
    n = name.strip().lower()
    table = _name_to_code()
    # Exact match first
    if n in table:
        return table[n]
    # Substring: a catalog key contained in the query (e.g. "frontier" in "frontier airlines operated by xyz")
    for key, code in table.items():
        if key and len(key) > 3 and key in n:
            return code
    return None


# --------------------------------------------------------------------------- #
#  Small parsers / geo helpers
# --------------------------------------------------------------------------- #
def _price_value(text) -> Optional[float]:
    if text is None:
        return None
    m = re.search(r"[\d,]+(?:\.\d+)?", str(text).replace(",", ""))
    return float(m.group()) if m else None


def _duration_minutes(text) -> Optional[int]:
    if not text:
        return None
    if isinstance(text, (int, float)):
        return int(text)
    h = re.search(r"(\d+)\s*h", str(text))
    m = re.search(r"(\d+)\s*m", str(text))
    if not h and not m:
        return None
    return (int(h.group(1)) * 60 if h else 0) + (int(m.group(1)) if m else 0)


def _fmt_duration(minutes: int) -> str:
    h, m = divmod(int(minutes), 60)
    if h and m:
        return f"{h}h {m}m"
    return f"{h}h" if h else f"{m}m"


def _haversine_km(a, b) -> float:
    r = 6371.0
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dp = math.radians(b.lat - a.lat)
    dl = math.radians(b.lon - a.lon)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def _clock(depart_date: str, dep_minutes: int, total_min: int):
    """Return ('8:10 AM · Aug 1', '9:35 PM · Aug 1', '+1'|'') for a flight that
    departs `dep_minutes` into `depart_date` and lasts `total_min`."""
    try:
        start = datetime.strptime(depart_date, "%Y-%m-%d") + timedelta(minutes=dep_minutes)
    except (ValueError, TypeError):
        start = datetime(2026, 1, 1) + timedelta(minutes=dep_minutes)
    end = start + timedelta(minutes=int(total_min or 0))

    def fmt(dt):
        # Cross-platform 12-hour format without leading zero.
        h = dt.hour % 12 or 12
        return f"{h}:{dt.minute:02d} {'AM' if dt.hour < 12 else 'PM'} · {dt.strftime('%b')} {dt.day}"

    ahead = (end.date() - start.date()).days
    return fmt(start), fmt(end), (f"+{ahead}" if ahead > 0 else "")


def _leg(frm, to, airline_code, flight_no, aircraft, minutes) -> Optional[dict]:
    a, b = airport_svc.get(frm), airport_svc.get(to)
    if not a or not b:
        return None
    info = _airlines().get(airline_code, {})
    return {
        "from": frm, "to": to,
        "fromName": a.name, "toName": b.name,
        "fromCity": a.city, "toCity": b.city,
        "fromLat": a.lat, "fromLon": a.lon, "toLat": b.lat, "toLon": b.lon,
        "airlineCode": airline_code, "airline": info.get("name", airline_code),
        "flightNumber": flight_no, "aircraft": aircraft,
        "durationMinutes": int(minutes), "durationText": _fmt_duration(minutes),
    }


def _layover(iata, minutes) -> Optional[dict]:
    ap = airport_svc.get(iata)
    if not ap:
        return None
    return {
        "airport": iata, "name": ap.name, "city": ap.city,
        "durationMinutes": int(minutes), "durationText": _fmt_duration(minutes),
        "short": minutes < 45, "long": minutes > 240,
    }


# --------------------------------------------------------------------------- #
#  Deal verdicts (relative within the result set + Google's signal)
# --------------------------------------------------------------------------- #
def _apply_deal_levels(results: list[dict], google_level: Optional[str]) -> None:
    prices = sorted(r["priceValue"] for r in results if r.get("priceValue"))
    if not prices:
        for r in results:
            r["dealLevel"] = "unknown"
            r["dealReason"] = "No price data"
        return
    cheapest = prices[0]
    median = prices[len(prices) // 2]
    # Bottom quartile counts as a genuinely good deal; prices from there up to
    # ~25% over the median are "typical". Keying "low" off the quartile (rather
    # than everything at/below the median) stops "typical" from being an almost
    # unreachable bucket on the small result sets that are the common case.
    quartile = prices[len(prices) // 4]
    for r in results:
        pv = r.get("priceValue")
        if pv is None:
            r["dealLevel"], r["dealReason"] = "unknown", "No price data"
        elif pv <= cheapest:
            r["dealLevel"] = "low"
            r["dealReason"] = "Cheapest in these results"
        elif pv <= quartile:
            r["dealLevel"] = "low"
            r["dealReason"] = "Well below the median price"
        elif pv <= median * 1.25:
            r["dealLevel"] = "typical"
            r["dealReason"] = "Around the typical price"
        else:
            r["dealLevel"] = "high"
            r["dealReason"] = "Pricier than most options"
        if google_level in ("low", "typical", "high"):
            r["googleDeal"] = google_level


# --------------------------------------------------------------------------- #
#  Real path: fast-flights
# --------------------------------------------------------------------------- #
_LAYOVER_RE = re.compile(r"Layover \(\d+ of \d+\) is an? (.+?) layover at (.+?) in ([^.]+?)\.")
_TIMES_RE = re.compile(r"Leaves .+? at (.+?) and arrives at .+? at (.+?)\.\s*Total duration (.+?)\.")


def _short_when(s: str) -> str:
    """'10:19 PM on Thursday, July 16' -> '10:19 PM · Jul 16'."""
    m = re.match(r"(.+?) on \w+, (\w+) (\d+)", s)
    return f"{m.group(1)} · {m.group(2)[:3]} {m.group(3)}" if m else s


def _date_tail(s: str) -> str:
    m = re.search(r" on (.+)$", s)
    return m.group(1) if m else ""


def _parse_label(label: str, origin, destination, o_ap, d_ap) -> Optional[dict]:
    """Parse one Google Flights row aria-label into a normalized itinerary,
    including resolved layover airports."""
    pm = re.search(r"From ([\d,]+)", label)
    price_val = float(pm.group(1).replace(",", "")) if pm else None

    if "Nonstop" in label:
        stops = 0
    else:
        sm = re.search(r"(\d+) stop", label)
        stops = int(sm.group(1)) if sm else 0

    am = re.search(r"flight with (.+?)\. Leaves", label)
    airlines = []
    if am:
        airlines = [a.strip() for a in am.group(1).replace(" and ", ", ").split(",") if a.strip()]

    tm = _TIMES_RE.search(label)
    departure = _short_when(tm.group(1)) if tm else ""
    arrival = _short_when(tm.group(2)) if tm else ""
    total_text = tm.group(3) if tm else ""
    total_min = _duration_minutes(total_text)
    ahead = "+1" if tm and _date_tail(tm.group(1)) and _date_tail(tm.group(1)) != _date_tail(tm.group(2)) else ""

    # Resolve layover airports -> coordinates.
    lay_raw = _LAYOVER_RE.findall(label)
    waypoints = [o_ap]
    lay_objs = []
    resolved = True
    for dur, apname, city in lay_raw:
        ap = airport_svc.match(apname, city)
        if not ap:
            resolved = False
            break
        waypoints.append(ap)
        lay_objs.append((ap, _duration_minutes(dur) or 0))
    waypoints.append(d_ap)

    codes = [c for c in {_code_for_name(a) for a in airlines} if c]
    base = {
        "airlines": airlines,
        "airlineCodes": codes,
        "stops": stops,
        "durationMinutes": total_min,
        "durationText": total_text or (_fmt_duration(total_min) if total_min else "—"),
        "priceText": f"${int(price_val)}" if price_val else "—",
        "priceValue": price_val,
        "departure": departure,
        "arrival": arrival,
        "arrivalTimeAhead": ahead,
        "isBest": False,
    }

    if resolved and lay_objs and o_ap and d_ap:
        # Build a leg per hop; distribute in-air time across legs by distance,
        # since Google gives total + exact layover times but not per-leg times.
        lay_sum = sum(m for _, m in lay_objs)
        flight_min = max(0, (total_min or 0) - lay_sum)
        dists = [_haversine_km(a, b) for a, b in zip(waypoints[:-1], waypoints[1:])]
        tot_d = sum(dists) or 1
        legs = []
        for k, (a, b) in enumerate(zip(waypoints[:-1], waypoints[1:])):
            leg_min = round(flight_min * dists[k] / tot_d) if flight_min else 0
            code = codes[0] if codes else ""
            leg = _leg(a.iata, b.iata, code, "", "", leg_min)
            if leg:
                legs.append(leg)
        layovers = [lo for lo in (_layover(ap.iata, m) for ap, m in lay_objs) if lo]
        return {**base, "legs": legs, "layovers": layovers, "legsDetailed": True, "estimated": True}

    # Couldn't resolve a layover (or nonstop): fall back to a single arc.
    single = _leg(origin, destination, codes[0] if codes else "", "", "", total_min or 0)
    return {**base, "legs": [single] if single else [], "layovers": [], "legsDetailed": stops == 0, "estimated": stops > 0}


# Google Flights' tfs protobuf models an airline-INCLUDE filter as a repeated
# string at FlightData field 6 (raw IATA code, e.g. "DL"). The vendored
# fast-flights proto doesn't declare that field, so we splice it into the leg
# bytes by hand. Verified empirically against live Google Flights
# (test_booking_url_airline_filter): passing "DL" narrows the opened list to
# Delta itineraries only, "B6" to JetBlue, etc.; unknown/omitted → full market.
_AIRLINE_INCLUDE_FIELD = 6
_IATA_AIRLINE = re.compile(r"^[A-Z0-9]{2}$")


def _pb_varint(n: int) -> bytes:
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)


def _pb_ld(field: int, payload: bytes) -> bytes:
    """Encode one length-delimited protobuf field (wire type 2)."""
    return bytes([(field << 3) | 2]) + _pb_varint(len(payload)) + payload


def _clean_airline_codes(airlines) -> list:
    """Keep only real 2-char IATA codes; a bogus code would make Google's filter
    return zero flights, so we drop anything unrecognized and fall back to an
    unfiltered (route/stops-only) list rather than an empty one."""
    seen, out = set(), []
    for code in airlines or []:
        c = (code or "").strip().upper()
        if _IATA_AIRLINE.match(c) and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _flightdata_bytes(date, frm, to, max_stops, airline_codes) -> bytes:
    """One serialized FlightData leg, with the airline-include filter spliced in.

    We let the library encode date/airport/max_stops (staying aligned with its
    wire format) and only hand-add the one field it doesn't model."""
    from fast_flights import flights_pb2 as PB

    holder = PB.Info()
    fd = holder.data.add()
    fd.date = date
    fd.from_flight.airport = frm
    fd.to_flight.airport = to
    if max_stops is not None:
        fd.max_stops = max_stops
    # holder serializes to exactly one length-delimited field 3 (data). Strip
    # that header to recover the raw FlightData bytes, then re-wrap.
    raw = holder.SerializeToString()
    assert raw and raw[0] == (3 << 3) | 2, "unexpected TFS layout"
    i, length, shift = 1, 0, 0
    while True:
        b = raw[i]
        i += 1
        length |= (b & 0x7F) << shift
        if not (b & 0x80):
            break
        shift += 7
    fd_bytes = raw[i:i + length]
    for code in airline_codes:
        fd_bytes += _pb_ld(_AIRLINE_INCLUDE_FIELD, code.encode())
    return _pb_ld(3, fd_bytes)


def _google_booking_url(origin, destination, depart_date, return_date, trip, seat, adults,
                        max_stops=None, airlines=None) -> Optional[str]:
    """Exact Google Flights deep link (tfs) for this route/date/cabin/passengers.
    Opens the real flight list — the booking surface — not a fuzzy text search.
    Optionally caps stops (so a nonstop selection lands on a nonstop-only list)
    and filters to the selected itinerary's airline(s) so the list opens on that
    carrier instead of the whole market."""
    try:
        from fast_flights import flights_pb2 as PB

        info = PB.Info()
        info.seat = {
            "economy": PB.Seat.ECONOMY, "premium-economy": PB.Seat.PREMIUM_ECONOMY,
            "business": PB.Seat.BUSINESS, "first": PB.Seat.FIRST,
        }[seat]
        info.trip = {
            "round-trip": PB.Trip.ROUND_TRIP, "one-way": PB.Trip.ONE_WAY,
            "multi-city": PB.Trip.MULTI_CITY,
        }[trip]
        for _ in range(max(1, adults)):
            info.passengers.append(PB.Passenger.ADULT)
        # Scalars (seat/trip/passengers) serialize on their own; legs (field 3)
        # are hand-built so we can splice the airline filter. Protobuf orders
        # known fields ascending, so leg-bytes-first + scalars matches the
        # library's own output byte-for-byte when no airline filter is applied.
        codes = _clean_airline_codes(airlines)
        legs = _flightdata_bytes(depart_date, origin, destination, max_stops, codes)
        if trip == "round-trip" and return_date:
            legs += _flightdata_bytes(return_date, destination, origin, max_stops, codes)
        tfs = base64.b64encode(legs + info.SerializeToString()).decode("utf-8")
        return f"https://www.google.com/travel/flights?tfs={tfs}&hl=en&curr=USD"
    except Exception:
        return None


def _pb_v(field: int, n: int) -> bytes:
    """Encode one varint protobuf field (wire type 0)."""
    return bytes([(field << 3) | 0]) + _pb_varint(n)


# A per-row Google lookup token: ORIGIN-DEST-AIRLINE-FLIGHTNUM-YYYYMMDD, e.g.
# "JFK-LAX-DL-701-20261215". Google embeds one per result row (the primary /
# first leg), which is exactly the identity a Booking-options deep link needs.
_ITIN_TOKEN_RE = re.compile(r"^([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]{2})-(\d+)-(\d{8})$")


def _parse_itin_token(tok: str) -> Optional[dict]:
    m = _ITIN_TOKEN_RE.match(tok or "")
    if not m:
        return None
    frm, to, code, num, ymd = m.groups()
    return {
        "from": frm, "to": to, "airline": code, "flightNumber": num,
        "date": f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}",
    }


def _nonstop_segment(tokens, origin, destination, depart_date) -> Optional[dict]:
    """The single selected segment for a nonstop result, from its row token.
    Requires an exact origin/destination/date match so we never point a booking
    link at the wrong flight."""
    for tok in tokens or []:
        seg = _parse_itin_token(tok)
        if seg and seg["from"] == origin and seg["to"] == destination and seg["date"] == depart_date:
            return seg
    return None


def _google_booking_options_url(segments, seat, adults) -> Optional[str]:
    """Deep link straight to Google Flights' **Booking options** page for one
    specific one-way itinerary — the vendor list you actually book from — rather
    than the results list. Needs each leg's airline code + flight number. The
    message shape (selected segment at FlightData field 4) was verified against
    live Google Flights."""
    try:
        seat_code = {"economy": 1, "premium-economy": 2, "business": 3, "first": 4}[seat]
        if not segments or not all(s.get("flightNumber") for s in segments):
            return None
        date = segments[0]["date"]
        # FlightData: date(2), selected segment(s) at field 4 (from/date/to/
        # airline/flightNumber), max_stops(5), airline-include(6), from(13), to(14).
        fd = _pb_ld(2, date.encode())
        for s in segments:
            seg = (_pb_ld(1, s["from"].encode()) + _pb_ld(2, s["date"].encode())
                   + _pb_ld(3, s["to"].encode()) + _pb_ld(5, s["airline"].encode())
                   + _pb_ld(6, str(s["flightNumber"]).encode()))
            fd += _pb_ld(4, seg)
        fd += _pb_v(5, len(segments) - 1)
        fd += _pb_ld(6, segments[0]["airline"].encode())
        fd += _pb_ld(13, _pb_v(1, 1) + _pb_ld(2, segments[0]["from"].encode()))
        fd += _pb_ld(14, _pb_v(1, 1) + _pb_ld(2, segments[-1]["to"].encode()))
        # Top-level header observed on the live booking page: f1=28, trip=one-way(2),
        # then passengers(8), seat(9), f14=1.
        body = _pb_v(1, 28) + _pb_v(2, 2) + _pb_ld(3, fd)
        for _ in range(max(1, adults)):
            body += _pb_v(8, 1)
        body += _pb_v(9, seat_code) + _pb_v(14, 1)
        tfs = base64.b64encode(body).decode("utf-8")
        return f"https://www.google.com/travel/flights/booking?tfs={tfs}&hl=en&curr=USD"
    except Exception:
        return None


def _attach_booking_urls(results, origin, destination, depart_date, return_date, trip, seat, adults):
    for r in results:
        url = None
        # Best case: a one-way nonstop whose flight number we resolved -> deep link
        # straight to that flight's Booking options page (the real "ways to book").
        if trip == "one-way" and r.get("stops") == 0:
            seg = _nonstop_segment(r.get("_itinTokens"), origin, destination, depart_date)
            if seg:
                url = _google_booking_options_url([seg], seat, adults)
                # Surface the flight number in the leg timeline too.
                if url and r.get("legs") and not r["legs"][0].get("flightNumber"):
                    r["legs"][0]["flightNumber"] = seg["flightNumber"]
        # Otherwise (connections, round trips, unresolved): open the results list
        # capped to this flight's stop count and filtered to its airline(s).
        if not url:
            url = _google_booking_url(
                origin, destination, depart_date, return_date, trip, seat, adults,
                max_stops=r.get("stops"),
                airlines=r.get("airlineCodes"),
            )
        r["bookingUrl"] = url
        r.pop("_itinTokens", None)


def _filter_results_by_stops(results: list[dict], max_stops: Optional[int]) -> list[dict]:
    if max_stops is None:
        return list(results)
    return [r for r in results if int(r.get("stops") or 0) <= max_stops]


def _result_airline_codes(r: dict) -> set[str]:
    codes = {str(code).upper() for code in (r.get("airlineCodes") or []) if code}
    codes.update(str(leg.get("airlineCode")).upper() for leg in (r.get("legs") or []) if leg.get("airlineCode"))
    return codes


def _filter_results_by_airline(results: list[dict], airline_code: Optional[str]) -> list[dict]:
    if not airline_code:
        return list(results)
    code = airline_code.upper()
    return [r for r in results if code in _result_airline_codes(r)]


def _filter_results(results: list[dict], max_stops: Optional[int],
                    airline_code: Optional[str]) -> list[dict]:
    return _filter_results_by_airline(_filter_results_by_stops(results, max_stops), airline_code)


def _result_identity(r: dict) -> tuple:
    return (
        r.get("priceValue"),
        r.get("durationMinutes"),
        tuple(lo.get("airport") for lo in r.get("layovers", [])),
        tuple(r.get("airlines", [])),
        tuple((leg.get("from"), leg.get("to")) for leg in r.get("legs", [])),
    )


def sanitize_search_response(out: dict, origin: str, destination: str, depart_date: str,
                             return_date: Optional[str], trip: str, seat: str, adults: int,
                             max_stops: Optional[int] = None,
                             airline_code: Optional[str] = None) -> dict:
    """Normalize a search payload before it is cached or serialized.

    This also protects the API boundary from stale in-memory cache entries created
    by older parser code.
    """
    clean = dict(out or {})
    seen = set()
    results = []
    for raw in _filter_results(clean.get("results") or [], max_stops, airline_code):
        if not raw or not raw.get("legs"):
            continue
        r = dict(raw)
        r.pop("_itinTokens", None)  # internal scrape scratch; never serialize it
        key = _result_identity(r)
        if key in seen:
            continue
        seen.add(key)
        r["id"] = str(len(results))
        if not r.get("bookingUrl"):
            r["bookingUrl"] = _google_booking_url(
                origin, destination, depart_date, return_date, trip, seat, adults,
                max_stops=r.get("stops"),
                airlines=r.get("airlineCodes"),
            )
        results.append(r)
    clean["results"] = results
    if not clean.get("bookingUrl"):
        clean["bookingUrl"] = _google_booking_url(
            origin, destination, depart_date, return_date, trip, seat, adults, max_stops=max_stops,
        )
    return clean


def _build_params(origin, destination, depart_date, return_date, trip, seat, adults,
                  max_stops: Optional[int] = None) -> str:
    from fast_flights.filter import TFSData
    from fast_flights.flights_impl import FlightData, Passengers

    fd = [FlightData(date=depart_date, from_airport=origin, to_airport=destination, max_stops=max_stops)]
    if trip == "round-trip" and return_date:
        fd.append(FlightData(date=return_date, from_airport=destination, to_airport=origin, max_stops=max_stops))
    tfs = TFSData.from_interface(
        flight_data=fd,
        trip=trip,
        passengers=Passengers(adults=max(1, adults), children=0, infants_in_seat=0, infants_on_lap=0),
        seat=seat,
    )
    return tfs.as_b64().decode("utf-8")


def _fetch_html(tfs_b64: str) -> str:
    """Fetch Google Flights HTML with retry; returns HTML once flight rows appear.
    Google serves a few layouts; aria-label rows are the stable, parseable signal."""
    from fast_flights.core import fetch

    params = {"tfs": tfs_b64, "hl": "en", "tfu": "EgQIABABIgA", "curr": "USD"}
    last_exc = None
    # Overall wall-clock budget across all retries so a slow upstream can't tie
    # up a worker indefinitely (each fetch also has its own per-request timeout).
    deadline = time.monotonic() + _FETCH_DEADLINE_S
    for _attempt in range(5):
        if time.monotonic() >= deadline:
            break
        try:
            html = fetch(params).text
        except Exception as exc:
            last_exc = exc
            continue
        if re.search(r'aria-label="From [^"]*?Select flight"', html):
            return html
        last_exc = RuntimeError("no flight rows parsed from Google Flights")
    raise last_exc or RuntimeError("Live search failed")


def _price_level_from_html(html: str) -> Optional[str]:
    try:
        from selectolax.lexbor import LexborHTMLParser

        node = LexborHTMLParser(html).css_first("span.gOatQ")
        if node:
            txt = node.text(strip=True).lower()
            return next((lvl for lvl in ("low", "typical", "high") if lvl in txt), None)
    except Exception:
        pass
    return None


def _results_from_html(html: str, origin: str, destination: str) -> list[dict]:
    o_ap, d_ap = airport_svc.get(origin), airport_svc.get(destination)
    label_matches = list(re.finditer(r'aria-label="(From [^"]*?Select flight)"', html))
    # Flight-number lookup tokens, positioned so each result row's token(s) fall
    # between its label and the next (see _attach_booking_urls).
    tokens = [(m.start(), m.group(1))
              for m in re.finditer(r"itinerary=([A-Z0-9]+(?:-[A-Z0-9]+){3}-\d{8})", html)]
    results, seen = [], set()
    for i, m in enumerate(label_matches):
        label = m.group(1)
        try:
            r = _parse_label(label, origin, destination, o_ap, d_ap)
        except Exception:
            continue
        if not r or not r["legs"]:
            continue
        key = (r["priceValue"], r["durationMinutes"], tuple(lo["airport"] for lo in r["layovers"]), tuple(r["airlines"]))
        if key in seen:
            continue
        seen.add(key)
        r["id"] = str(len(results))
        nxt = label_matches[i + 1].start() if i + 1 < len(label_matches) else len(html)
        r["_itinTokens"] = list(dict.fromkeys(t for p, t in tokens if m.start() < p < nxt))
        results.append(r)
    return results


def _scrape_return(destination, origin, return_date, seat, adults, max_stops: Optional[int] = None,
                   airline_code: Optional[str] = None) -> Optional[dict]:
    """Best-effort: scrape the return direction (DEST->ORIGIN on the return date)
    as a one-way and return a single representative itinerary (the cheapest), so
    the round trip's return leg can be visualized and described. Google bundles
    round-trip pricing across the outbound selection, so this return's own price
    is not shown — only its route, times and layovers."""
    try:
        tfs = _build_params(destination, origin, return_date, None, "one-way", seat, adults, max_stops)
        html = _fetch_html(tfs)
        rets = _filter_results(_results_from_html(html, destination, origin), max_stops, airline_code)
        if not rets:
            return None
        rets.sort(key=lambda r: r["priceValue"] or 9e9)
        best = rets[0]
        best.pop("priceText", None)  # don't surface a misleading one-way return price
        best.pop("priceValue", None)
        best.pop("_itinTokens", None)  # internal scrape scratch
        return best
    except Exception:
        return None


def _search_live(origin, destination, depart_date, return_date, trip, seat, adults,
                 max_stops: Optional[int] = None,
                 airline_code: Optional[str] = None) -> dict:
    # Fetch the raw HTML and parse the per-row aria-labels (exact layover airports,
    # durations, and start/end times that fast-flights' summary parser discards).
    tfs = _build_params(origin, destination, depart_date, return_date, trip, seat, adults, max_stops)
    html = _fetch_html(tfs)
    price_level = _price_level_from_html(html)
    results = _filter_results(_results_from_html(html, origin, destination), max_stops, airline_code)
    if not results:
        raise RuntimeError("Live search returned no usable flights")

    _apply_deal_levels(results, price_level)
    _attach_booking_urls(results, origin, destination, depart_date, return_date, trip, seat, adults)

    out = {
        "source": "google-flights (live)",
        "priceLevel": price_level,
        "results": results,
        "bookingUrl": f"https://www.google.com/travel/flights?tfs={tfs}&hl=en&curr=USD",
    }
    if trip == "round-trip" and return_date:
        out["returnItinerary"] = _scrape_return(
            destination, origin, return_date, seat, adults, max_stops, airline_code,
        )
    return out


# --------------------------------------------------------------------------- #
#  Mock path: fully detailed itineraries
# --------------------------------------------------------------------------- #
_HUBS = ["LHR", "FRA", "AMS", "DXB", "DOH", "IST", "SIN", "HKG", "NRT",
         "JFK", "ATL", "ORD", "LAX", "CDG", "MAD", "ADD", "GRU", "PANC"]
_LONGHAUL_AIRCRAFT = ["Boeing 787-9", "Airbus A350-900", "Boeing 777-300ER", "Airbus A380"]
_SHORTHAUL_AIRCRAFT = ["Airbus A320neo", "Boeing 737-800", "Airbus A321", "Embraer E190"]
_LONGHAUL_AIRLINES = ["QR", "EK", "TK", "SQ", "LH", "BA", "NH"]
_SHORTHAUL_AIRLINES = ["DL", "AA", "UA", "B6", "AS"]


def _aircraft_for(km, idx):
    pool = _LONGHAUL_AIRCRAFT if km > 4000 else _SHORTHAUL_AIRCRAFT
    return pool[idx % len(pool)]


def _airline_for(km, idx):
    pool = _LONGHAUL_AIRLINES if km > 3000 else _SHORTHAUL_AIRLINES
    return pool[idx % len(pool)]


def _flight_minutes(km):
    return int(km / 800 * 60) + 35  # cruise + taxi/climb


def _mock_itineraries(origin, destination, date) -> list[dict]:
    """Build full-detail demo itineraries (nonstop + two 1-stops) with real
    departure/arrival clock times, for one direction on one date."""
    a, b = airport_svc.get(origin), airport_svc.get(destination)
    if not a or not b:
        return []
    direct_km = _haversine_km(a, b)
    out = []

    # 1) Nonstop (departs 08:10)
    code = _airline_for(direct_km, 0)
    nonstop_min = _flight_minutes(direct_km)
    leg = _leg(origin, destination, code, f"{code}{100 + (len(origin) % 800)}",
               _aircraft_for(direct_km, 0), nonstop_min)
    if leg:
        dep, arr, ahead = _clock(date, 8 * 60 + 10, nonstop_min)
        out.append({
            "airlines": [_airlines()[code]["name"]], "airlineCodes": [code],
            "stops": 0, "durationMinutes": nonstop_min, "durationText": _fmt_duration(nonstop_min),
            "priceValue": round(direct_km * 0.11 + 90, 0),
            "departure": dep, "arrival": arr, "arrivalTimeAhead": ahead,
            "isBest": True, "legs": [leg], "layovers": [], "legsDetailed": True,
        })

    # 2) + 3) one-stop options via two hubs (depart 11:25)
    hubs = [h for h in _HUBS if h not in (origin, destination) and airport_svc.get(h)]
    for n, hub in enumerate(hubs[:2], start=1):
        h = airport_svc.get(hub)
        km1, km2 = _haversine_km(a, h), _haversine_km(h, b)
        m1, m2 = _flight_minutes(km1), _flight_minutes(km2)
        lay = 60 + n * 55
        ac = _airline_for(km1, n)
        legs = [
            _leg(origin, hub, ac, f"{ac}{200 + n*11}", _aircraft_for(km1, n), m1),
            _leg(hub, destination, ac, f"{ac}{300 + n*11}", _aircraft_for(km2, n + 1), m2),
        ]
        lays = [_layover(hub, lay)]
        if any(x is None for x in legs) or any(x is None for x in lays):
            continue
        total = m1 + lay + m2
        dep, arr, ahead = _clock(date, 11 * 60 + 25, total)
        out.append({
            "airlines": [_airlines()[ac]["name"]], "airlineCodes": [ac],
            "stops": 1, "durationMinutes": total, "durationText": _fmt_duration(total),
            "priceValue": round((km1 + km2) * 0.085 + 60 + n * 25, 0),
            "departure": dep, "arrival": arr, "arrivalTimeAhead": ahead,
            "isBest": False, "legs": legs, "layovers": lays, "legsDetailed": True,
        })

    for r in out:
        pv = r["priceValue"]
        r["priceText"] = f"${int(pv)}" if pv else "—"
    return out


def _search_mock(origin, destination, depart_date, return_date, trip, seat, adults,
                 max_stops: Optional[int] = None,
                 airline_code: Optional[str] = None) -> dict:
    results = _filter_results(_mock_itineraries(origin, destination, depart_date), max_stops, airline_code)
    if not results:
        raise RuntimeError(f"Unknown airport(s): {origin}/{destination}")
    for i, r in enumerate(results):
        r["id"] = str(i)

    _apply_deal_levels(results, "typical")
    _attach_booking_urls(results, origin, destination, depart_date, return_date, trip, seat, adults)
    out = {
        "source": "mock (full detail demo)",
        "priceLevel": "typical",
        "results": sorted(results, key=lambda r: r["priceValue"] or 9e9),
    }
    if trip == "round-trip" and return_date:
        rets = _filter_results(_mock_itineraries(destination, origin, return_date), max_stops, airline_code)
        if rets:
            best = min(rets, key=lambda r: r["priceValue"] or 9e9)
            best.pop("priceText", None)
            best.pop("priceValue", None)
            out["returnItinerary"] = best
    return out


# --------------------------------------------------------------------------- #
#  Public entry point
# --------------------------------------------------------------------------- #
def search(origin: str, destination: str, depart_date: str,
           return_date: Optional[str], trip: str, seat: str, adults: int,
           max_stops: Optional[int] = None,
           airline_code: Optional[str] = None) -> dict:
    origin = (origin or "").upper()
    destination = (destination or "").upper()
    force_mock = os.environ.get("FLIGHT_SCANNER_MOCK", "") in ("1", "true", "yes")

    if not force_mock:
        try:
            out = _search_live(origin, destination, depart_date, return_date, trip, seat, adults, max_stops, airline_code)
            out["query"] = _query_echo(
                origin, destination, depart_date, return_date, trip, seat, adults, max_stops, airline_code,
            )
            return out
        except Exception as exc:  # graceful fallback, never crash
            traceback.print_exc()  # full detail in server logs for diagnosis
            out = _search_mock(origin, destination, depart_date, return_date, trip, seat, adults, max_stops, airline_code)
            reason = str(exc).strip() or type(exc).__name__
            out["notice"] = (
                "Live Google Flights didn't return usable data this time "
                f"({reason}); showing demo data. Try again in a moment."
            )
            out["query"] = _query_echo(
                origin, destination, depart_date, return_date, trip, seat, adults, max_stops, airline_code,
            )
            return out

    out = _search_mock(origin, destination, depart_date, return_date, trip, seat, adults, max_stops, airline_code)
    out["query"] = _query_echo(origin, destination, depart_date, return_date, trip, seat, adults, max_stops, airline_code)
    return out


def _query_echo(origin, destination, depart_date, return_date, trip, seat, adults,
                max_stops: Optional[int] = None,
                airline_code: Optional[str] = None) -> dict:
    a, b = airport_svc.get(origin), airport_svc.get(destination)
    return {
        "origin": origin, "destination": destination,
        "originCity": a.city if a else origin, "destinationCity": b.city if b else destination,
        "departDate": depart_date, "returnDate": return_date,
        "trip": trip, "seat": seat, "adults": adults,
        "maxStops": max_stops, "airlineCode": airline_code.upper() if airline_code else None,
    }
