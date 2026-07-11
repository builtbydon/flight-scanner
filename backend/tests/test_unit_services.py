"""Unit tests for pure backend logic (no network)."""
from fastapi.encoders import jsonable_encoder

from services import airports as A
from services import flights as F


# ---------------------------------------------------------------- airports ---
def test_get_known_airport_has_coords():
    sea = A.get("SEA")
    assert sea and sea.iata == "SEA"
    assert 47 < sea.lat < 48 and -123 < sea.lon < -122


def test_search_by_code_and_city():
    codes = [r["iata"] for r in A.search("SEA")]
    assert "SEA" in codes
    assert any(r["iata"] == "LHR" for r in A.search("heathrow"))
    assert A.search("") == []


def test_match_resolves_google_names():
    assert A.match("John F. Kennedy International Airport", "New York").iata == "JFK"
    assert A.match("Zurich Airport", "Zürich").iata == "ZRH"
    assert A.match("Keflavík International Airport", "Reykjavík").iata == "KEF"
    # short name resolved via distinctive-token fallback
    assert A.match("Heathrow Airport", "London").iata == "LHR"


# ----------------------------------------------------------------- parsers ---
def test_duration_and_price_parsers():
    assert F._duration_minutes("14 hr 26 min") == 14 * 60 + 26
    assert F._duration_minutes("2h 5m") == 125
    assert F._duration_minutes("") is None
    assert F._price_value("$501") == 501.0
    assert F._price_value("1,234") == 1234.0
    assert F._fmt_duration(125) == "2h 5m"


def test_airline_card_lookup():
    aa = F.airline_card("AA")
    assert aa and "American" in aa["name"]
    assert F.airline_card("ZZ") is None


def test_code_for_name():
    assert F._code_for_name("JetBlue") == "B6"
    assert F._code_for_name("British Airways") == "BA"
    assert F._code_for_name("Frontier Airlines operated by Republic Airways") == "F9"
    assert F._code_for_name("Japan Airlines (JAL)") == "JL"
    assert F._code_for_name("Totally Fake Air") is None


# ------------------------------------------------------------ aria-label -----
SAMPLE_LABEL = (
    "From 501 US dollars. 1 stop flight with JetBlue. Leaves Seattle-Tacoma "
    "International Airport at 10:19 PM on Thursday, July 16 and arrives at Heathrow "
    "Airport at 8:45 PM on Friday, July 17. Total duration 14 hr 26 min.  Layover "
    "(1 of 1) is a 2 hr 6 min layover at John F. Kennedy International Airport in "
    "New York. Carbon emissions estimate: 865 kilograms. +53% emissions. Select flight"
)


def test_parse_label_extracts_layover():
    o, d = A.get("SEA"), A.get("LHR")
    r = F._parse_label(SAMPLE_LABEL, "SEA", "LHR", o, d)
    assert r["priceValue"] == 501.0
    assert r["stops"] == 1
    assert r["airlines"] == ["JetBlue"]
    assert r["airlineCodes"] == ["B6"]
    assert r["legsDetailed"] is True
    assert r["arrivalTimeAhead"] == "+1"
    # full route SEA -> JFK -> LHR with the JFK layover resolved
    assert [leg["from"] for leg in r["legs"]] == ["SEA", "JFK"]
    assert r["legs"][-1]["to"] == "LHR"
    assert len(r["layovers"]) == 1
    assert r["layovers"][0]["airport"] == "JFK"
    assert r["layovers"][0]["durationText"] == "2h 6m"


MESSY_PROVIDER_HTML = """
<html>
  <body>
    <span class="gOatQ">Prices are currently low</span>
    <div aria-label="From 640 US dollars. Nonstop flight with Delta Air Lines. Leaves Seattle-Tacoma International Airport at 9:00 AM on Thursday, July 16 and arrives at Narita International Airport at 11:15 AM on Friday, July 17. Total duration 10 hr 15 min. Carbon emissions estimate: 650 kilograms. Select flight"></div>
    <div aria-label="From 1,234 US dollars. 2 stop flight with Frontier Airlines operated by Republic Airways and Japan Airlines (JAL). Leaves Seattle-Tacoma International Airport at 6:05 AM on Thursday, July 16 and arrives at Narita International Airport at 3:20 PM on Friday, July 17. Total duration 18 hr 15 min.  Layover (1 of 2) is a 39 min layover at Denver International Airport in Denver. Layover (2 of 2) is a 4 hr 15 min layover at Los Angeles International Airport in Los Angeles. Carbon emissions estimate: 750 kilograms. Select flight"></div>
    <div aria-label="From 1,234 US dollars. 2 stop flight with Frontier Airlines operated by Republic Airways and Japan Airlines (JAL). Leaves Seattle-Tacoma International Airport at 6:05 AM on Thursday, July 16 and arrives at Narita International Airport at 3:20 PM on Friday, July 17. Total duration 18 hr 15 min.  Layover (1 of 2) is a 39 min layover at Denver International Airport in Denver. Layover (2 of 2) is a 4 hr 15 min layover at Los Angeles International Airport in Los Angeles. Carbon emissions estimate: 750 kilograms. Select flight"></div>
  </body>
</html>
"""


def test_results_from_html_handles_messy_provider_label_and_dedupes():
    results = F._results_from_html(MESSY_PROVIDER_HTML, "SEA", "NRT")
    assert len(results) == 2, "duplicate provider rows should not produce duplicate visible options"
    r = next(r for r in results if r["stops"] == 2)
    assert r["priceValue"] == 1234.0
    assert r["stops"] == 2
    assert r["arrivalTimeAhead"] == "+1"
    assert set(r["airlineCodes"]) >= {"F9", "JL"}
    assert [leg["from"] for leg in r["legs"]] == ["SEA", "DEN", "LAX"]
    assert r["legs"][-1]["to"] == "NRT"
    assert [lo["airport"] for lo in r["layovers"]] == ["DEN", "LAX"]
    assert r["layovers"][0]["short"] is True
    assert r["layovers"][1]["long"] is True


def test_parse_label_falls_back_when_provider_layover_cannot_be_resolved():
    label = (
        "From 742 US dollars. 1 stop flight with Imaginary Sky. Leaves Seattle-Tacoma "
        "International Airport at 9:00 AM on Thursday, July 16 and arrives at Heathrow "
        "Airport at 9:15 AM on Friday, July 17. Total duration 17 hr 15 min.  Layover "
        "(1 of 1) is a 2 hr layover at Short Hop Field in Nowhere. Select flight"
    )
    r = F._parse_label(label, "SEA", "LHR", A.get("SEA"), A.get("LHR"))
    assert r["airlines"] == ["Imaginary Sky"]
    assert r["airlineCodes"] == []
    assert r["legsDetailed"] is False
    assert r["estimated"] is True
    assert r["layovers"] == []
    assert [leg["from"] for leg in r["legs"]] == ["SEA"]
    assert r["legs"][0]["to"] == "LHR"


def test_sanitize_search_response_dedupes_stale_provider_cache_for_serialization():
    parsed = F._results_from_html(MESSY_PROVIDER_HTML, "SEA", "NRT")
    multi_stop = next(r for r in parsed if r["stops"] == 2)
    stale_duplicate = {**multi_stop, "id": "old-cache", "bookingUrl": None}
    out = F.sanitize_search_response(
        {
            "source": "google-flights (live)",
            "priceLevel": "low",
            "results": [multi_stop, stale_duplicate],
            "bookingUrl": None,
        },
        "SEA",
        "NRT",
        "2026-08-01",
        None,
        "one-way",
        "economy",
        1,
    )
    encoded = jsonable_encoder(out)
    assert len(encoded["results"]) == 1
    assert encoded["results"][0]["id"] == "0"
    assert encoded["results"][0]["bookingUrl"].startswith("https://www.google.com/travel/flights")
    assert [lo["airport"] for lo in encoded["results"][0]["layovers"]] == ["DEN", "LAX"]


def test_sanitize_search_response_applies_max_stops_to_stale_provider_cache():
    parsed = F._results_from_html(MESSY_PROVIDER_HTML, "SEA", "NRT")
    out = F.sanitize_search_response(
        {
            "source": "google-flights (live)",
            "priceLevel": "low",
            "results": parsed,
            "bookingUrl": None,
        },
        "SEA",
        "NRT",
        "2026-08-01",
        None,
        "one-way",
        "economy",
        1,
        max_stops=0,
    )
    encoded = jsonable_encoder(out)
    assert len(encoded["results"]) == 1
    assert encoded["results"][0]["stops"] == 0
    assert encoded["results"][0]["durationText"] == "10 hr 15 min"


def test_sanitize_search_response_applies_airline_filter_to_stale_provider_cache():
    parsed = F._results_from_html(MESSY_PROVIDER_HTML, "SEA", "NRT")
    out = F.sanitize_search_response(
        {
            "source": "google-flights (live)",
            "priceLevel": "low",
            "results": parsed,
            "bookingUrl": None,
        },
        "SEA",
        "NRT",
        "2026-08-01",
        None,
        "one-way",
        "economy",
        1,
        airline_code="JL",
    )
    encoded = jsonable_encoder(out)
    assert len(encoded["results"]) == 1
    assert encoded["results"][0]["stops"] == 2
    assert set(encoded["results"][0]["airlineCodes"]) >= {"F9", "JL"}


# ------------------------------------------------------------- deal levels ---
def test_apply_deal_levels():
    results = [{"priceValue": 100}, {"priceValue": 200}, {"priceValue": 900}]
    F._apply_deal_levels(results, None)
    assert results[0]["dealLevel"] == "low"  # cheapest
    assert results[2]["dealLevel"] == "high"  # far above median


def test_booking_url_is_google_tfs():
    url = F._google_booking_url("SEA", "LHR", "2026-07-16", None, "one-way", "economy", 1)
    assert url and url.startswith("https://www.google.com/travel/flights?tfs=")


def _tfs_bytes(url: str) -> bytes:
    import base64
    from urllib.parse import parse_qs, urlparse

    tfs = parse_qs(urlparse(url).query)["tfs"][0]
    return base64.b64decode(tfs)


# FlightData field 6 = airline-include filter, encoded as `\x32<len><code>`.
_AIRLINE_FRAME = bytes([(6 << 3) | 2])  # 0x32


def test_booking_url_no_airline_filter_matches_library_exactly():
    """With no airline codes the URL must be byte-identical to fast-flights' own
    tfs — our hand-rolled encoder only adds the one extra field."""
    from fast_flights.filter import TFSData
    from fast_flights.flights_impl import FlightData, Passengers

    fd = [FlightData(date="2026-07-16", from_airport="SEA", to_airport="LHR", max_stops=0)]
    lib = TFSData.from_interface(
        flight_data=fd, trip="one-way",
        passengers=Passengers(adults=1), seat="economy",
    ).as_b64().decode("utf-8")
    ours = F._google_booking_url("SEA", "LHR", "2026-07-16", None, "one-way", "economy", 1, max_stops=0)
    assert ours == f"https://www.google.com/travel/flights?tfs={lib}&hl=en&curr=USD"
    assert _AIRLINE_FRAME + b"\x02" not in _tfs_bytes(ours)


def test_booking_url_airline_filter_encodes_selected_carrier():
    """Selecting a flight bakes its airline(s) into the tfs so Google opens on
    that carrier — verified empirically that field 6 = airline-include."""
    url = F._google_booking_url(
        "JFK", "LAX", "2026-12-15", None, "one-way", "economy", 1,
        max_stops=0, airlines=["DL"],
    )
    raw = _tfs_bytes(url)
    assert _AIRLINE_FRAME + b"\x02" + b"DL" in raw
    # Codeshare / multi-airline results carry several codes; all get included.
    multi = _tfs_bytes(F._google_booking_url(
        "JFK", "LAX", "2026-12-15", None, "one-way", "economy", 1,
        max_stops=1, airlines=["DL", "B6"],
    ))
    assert _AIRLINE_FRAME + b"\x02" + b"DL" in multi
    assert _AIRLINE_FRAME + b"\x02" + b"B6" in multi


def test_booking_url_drops_bogus_airline_codes():
    """A non-IATA code would make Google's filter return zero flights; we drop it
    and fall back to an unfiltered list instead."""
    url = F._google_booking_url(
        "JFK", "LAX", "2026-12-15", None, "one-way", "economy", 1,
        airlines=["", "Delta", "d l", None],  # none are valid 2-char codes
    )
    assert _AIRLINE_FRAME + b"\x02" not in _tfs_bytes(url)


def test_attach_booking_urls_differ_by_airline():
    """Regression: before the airline filter, two flights on the same route got
    identical booking links. Now each result's link targets its own carrier."""
    results = [
        {"stops": 0, "airlineCodes": ["DL"]},
        {"stops": 0, "airlineCodes": ["AA"]},
    ]
    F._attach_booking_urls(results, "JFK", "LAX", "2026-12-15", None, "one-way", "economy", 1)
    assert results[0]["bookingUrl"] != results[1]["bookingUrl"]
    assert _AIRLINE_FRAME + b"\x02" + b"DL" in _tfs_bytes(results[0]["bookingUrl"])
    assert _AIRLINE_FRAME + b"\x02" + b"AA" in _tfs_bytes(results[1]["bookingUrl"])


# ------------------------------------------- booking-options (exact flight) ---
def test_parse_itin_token():
    seg = F._parse_itin_token("JFK-LAX-DL-701-20261215")
    assert seg == {"from": "JFK", "to": "LAX", "airline": "DL",
                   "flightNumber": "701", "date": "2026-12-15"}
    assert F._parse_itin_token("not-a-token") is None
    assert F._parse_itin_token("") is None


def test_booking_options_url_encodes_selected_segment():
    """The /booking deep link opens Google's 'Booking options' page for one exact
    flight; verify the selected segment (airline + flight number) is encoded."""
    seg = {"from": "JFK", "to": "LAX", "airline": "DL", "flightNumber": "701", "date": "2026-12-15"}
    url = F._google_booking_options_url([seg], "economy", 1)
    assert url and url.startswith("https://www.google.com/travel/flights/booking?tfs=")
    raw = _tfs_bytes(url)
    # selected-segment fields: airline (f5) and flight number (f6) as raw strings
    assert _AIRLINE_FRAME + b"\x02" + b"DL" in raw  # airline-include (f6) + f5 both encode "DL"
    assert b"701" in raw and b"JFK" in raw and b"LAX" in raw


def test_booking_options_url_needs_a_flight_number():
    seg = {"from": "JFK", "to": "LAX", "airline": "DL", "flightNumber": "", "date": "2026-12-15"}
    assert F._google_booking_options_url([seg], "economy", 1) is None


def test_attach_booking_urls_nonstop_deep_links_to_booking_options():
    """A one-way nonstop with a resolved flight-number token deep-links straight
    to the flight's Booking options page and surfaces the flight number."""
    results = [{
        "stops": 0, "airlineCodes": ["DL"],
        "legs": [{"from": "JFK", "to": "LAX", "flightNumber": ""}],
        "_itinTokens": ["JFK-LAX-DL-701-20261215"],
    }]
    F._attach_booking_urls(results, "JFK", "LAX", "2026-12-15", None, "one-way", "economy", 1)
    r = results[0]
    assert r["bookingUrl"].startswith("https://www.google.com/travel/flights/booking?tfs=")
    assert r["legs"][0]["flightNumber"] == "701"  # surfaced for the leg timeline
    assert "_itinTokens" not in r  # internal scratch never serialized


def test_attach_booking_urls_falls_back_when_not_a_clean_nonstop():
    """Connections, round trips, and route-mismatched tokens can't identify one
    exact flight, so they open the (airline-filtered) results list instead."""
    def book(result, trip="one-way", ret=None):
        rs = [dict(result)]
        F._attach_booking_urls(rs, "JFK", "LAX", "2026-12-15", ret, trip, "economy", 1)
        return rs[0]["bookingUrl"]

    nonstop = {"stops": 0, "airlineCodes": ["DL"],
               "legs": [{"from": "JFK", "to": "LAX", "flightNumber": ""}],
               "_itinTokens": ["JFK-LAX-DL-701-20261215"]}
    # 1-stop -> search list (only the first leg's number is knowable)
    conn = {**nonstop, "stops": 1}
    assert "/travel/flights/booking" not in book(conn)
    # round trip -> can't deep-link a two-way booking page
    assert "/travel/flights/booking" not in book(nonstop, trip="round-trip", ret="2026-12-22")
    # token for a different route must never be trusted
    wrong = {**nonstop, "_itinTokens": ["JFK-SFO-DL-701-20261215"]}
    assert "/travel/flights/booking" not in book(wrong)


# --------------------------------------------------------------- mock path ---
def test_mock_search_builds_detailed_itineraries():
    out = F._search_mock("JFK", "SIN", "2026-08-01", None, "one-way", "economy", 1)
    assert out["results"]
    multi = [r for r in out["results"] if r["stops"] >= 1]
    assert multi, "expected at least one multi-leg itinerary"
    r = multi[0]
    assert r["layovers"] and r["layovers"][0]["airport"]
    assert all(leg["from"] and leg["to"] for leg in r["legs"])
    assert r["bookingUrl"].startswith("https://www.google.com/travel/flights")


def test_mock_search_filters_by_max_stops():
    out = F._search_mock("JFK", "SIN", "2026-08-01", None, "one-way", "economy", 1, max_stops=0)
    assert out["results"]
    assert {r["stops"] for r in out["results"]} == {0}


def test_mock_search_filters_by_airline_code():
    out = F._search_mock("JFK", "SIN", "2026-08-01", None, "one-way", "economy", 1, airline_code="QR")
    assert out["results"]
    assert all("QR" in F._result_airline_codes(r) for r in out["results"])


def test_clock_returns_real_start_end_times():
    dep, arr, ahead = F._clock("2026-08-01", 8 * 60 + 10, 60 * 14 + 26)  # depart 8:10, 14h26m
    assert dep == "8:10 AM · Aug 1"
    assert arr == "10:36 PM · Aug 1"
    assert ahead == ""
    # an overnight flight rolls into +1
    _, _, ahead2 = F._clock("2026-08-01", 23 * 60, 300)  # depart 11pm, 5h
    assert ahead2 == "+1"


def test_mock_results_have_real_departure_and_arrival():
    out = F._search_mock("JFK", "SIN", "2026-08-01", None, "one-way", "economy", 1)
    r = out["results"][0]
    assert ":" in r["departure"] and ("AM" in r["departure"] or "PM" in r["departure"])
    assert ":" in r["arrival"] and ("AM" in r["arrival"] or "PM" in r["arrival"])


def test_mock_round_trip_includes_return_itinerary():
    out = F._search_mock("SEA", "LHR", "2026-08-01", "2026-08-15", "round-trip", "economy", 1)
    ret = out.get("returnItinerary")
    assert ret, "round-trip should include a return itinerary"
    # return goes the other way (LHR -> ... -> SEA) on the return date
    assert ret["legs"][0]["from"] == "LHR"
    assert ret["legs"][-1]["to"] == "SEA"
    assert ret["departure"] and ret["arrival"]
    assert "priceText" not in ret  # no misleading separate return price
    # one-way search has no return itinerary
    assert "returnItinerary" not in F._search_mock("SEA", "LHR", "2026-08-01", None, "one-way", "economy", 1)
