"""Integration tests: exercise the real FastAPI routes end-to-end via TestClient.

Runs in FLIGHT_SCANNER_MOCK=1 (set in conftest) so there is no network access —
the search endpoint returns full-detail mock itineraries.
"""
import os

os.environ["FLIGHT_SCANNER_MOCK"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from services import cache  # noqa: E402
from services import flights as flight_svc  # noqa: E402

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["mock"] is True


def test_airports_autocomplete():
    r = client.get("/api/airports", params={"q": "seattle"})
    assert r.status_code == 200
    assert any(a["iata"] == "SEA" for a in r.json()["results"])


def test_airline_card_and_404():
    assert client.get("/api/airlines/AA").json()["name"].startswith("American")
    assert client.get("/api/airlines/ZZ").status_code == 404


def test_search_returns_detailed_results():
    r = client.post(
        "/api/search",
        json={
            "origin": "JFK",
            "destination": "SIN",
            "departDate": "2026-08-01",
            "returnDate": None,
            "trip": "one-way",
            "seat": "economy",
            "adults": 1,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["results"], "expected itineraries"
    r0 = data["results"][0]
    for key in ("priceText", "durationText", "stops", "legs", "dealLevel", "bookingUrl"):
        assert key in r0
    # at least one itinerary has a resolved layover with a duration
    assert any(r["layovers"] and r["layovers"][0]["durationText"] for r in data["results"])


def test_search_filters_results_by_max_stops():
    r = client.post(
        "/api/search",
        json={
            "origin": "JFK",
            "destination": "SIN",
            "departDate": "2026-08-03",
            "returnDate": None,
            "trip": "one-way",
            "seat": "economy",
            "adults": 1,
            "maxStops": 0,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["query"]["maxStops"] == 0
    assert data["results"], "expected at least one nonstop itinerary"
    assert {result["stops"] for result in data["results"]} == {0}


def test_search_filters_results_by_airline_code():
    r = client.post(
        "/api/search",
        json={
            "origin": "JFK",
            "destination": "SIN",
            "departDate": "2026-08-04",
            "returnDate": None,
            "trip": "one-way",
            "seat": "economy",
            "adults": 1,
            "airlineCode": "QR",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["query"]["airlineCode"] == "QR"
    assert data["results"], "expected at least one Qatar itinerary"
    assert all("QR" in flight_svc._result_airline_codes(result) for result in data["results"])


def test_search_shows_start_and_end_times():
    r = client.post(
        "/api/search",
        json={"origin": "JFK", "destination": "SIN", "departDate": "2026-08-01",
              "trip": "one-way", "seat": "economy", "adults": 1},
    )
    r0 = r.json()["results"][0]
    assert ":" in r0["departure"] and ":" in r0["arrival"]
    assert r0["departure"] != r0["arrival"]


def test_round_trip_returns_return_itinerary():
    r = client.post(
        "/api/search",
        json={"origin": "SEA", "destination": "LHR", "departDate": "2026-08-01",
              "returnDate": "2026-08-15", "trip": "round-trip", "seat": "economy", "adults": 1},
    )
    data = r.json()
    ret = data.get("returnItinerary")
    assert ret and ret["legs"][0]["from"] == "LHR" and ret["legs"][-1]["to"] == "SEA"
    assert ret["departure"] and ret["arrival"]


def test_search_rejects_same_origin_destination():
    r = client.post(
        "/api/search",
        json={"origin": "JFK", "destination": "JFK", "departDate": "2026-08-01",
              "trip": "one-way", "seat": "economy", "adults": 1},
    )
    assert r.status_code == 400


def test_search_is_cached_on_repeat():
    body = {"origin": "SEA", "destination": "LHR", "departDate": "2026-08-01",
            "returnDate": None, "trip": "one-way", "seat": "economy", "adults": 1}
    assert client.post("/api/search", json=body).json()["cached"] is False
    assert client.post("/api/search", json=body).json()["cached"] is True


MESSY_PROVIDER_HTML = """
<html>
  <body>
    <div aria-label="From 640 US dollars. Nonstop flight with Delta Air Lines. Leaves Seattle-Tacoma International Airport at 9:00 AM on Thursday, July 16 and arrives at Narita International Airport at 11:15 AM on Friday, July 17. Total duration 10 hr 15 min. Select flight"></div>
    <div aria-label="From 1,234 US dollars. 2 stop flight with Frontier Airlines operated by Republic Airways and Japan Airlines (JAL). Leaves Seattle-Tacoma International Airport at 6:05 AM on Thursday, July 16 and arrives at Narita International Airport at 3:20 PM on Friday, July 17. Total duration 18 hr 15 min.  Layover (1 of 2) is a 39 min layover at Denver International Airport in Denver. Layover (2 of 2) is a 4 hr 15 min layover at Los Angeles International Airport in Los Angeles. Select flight"></div>
    <div aria-label="From 1,234 US dollars. 2 stop flight with Frontier Airlines operated by Republic Airways and Japan Airlines (JAL). Leaves Seattle-Tacoma International Airport at 6:05 AM on Thursday, July 16 and arrives at Narita International Airport at 3:20 PM on Friday, July 17. Total duration 18 hr 15 min.  Layover (1 of 2) is a 39 min layover at Denver International Airport in Denver. Layover (2 of 2) is a 4 hr 15 min layover at Los Angeles International Airport in Los Angeles. Select flight"></div>
  </body>
</html>
"""


def test_cached_provider_payload_is_sanitized_at_api_boundary():
    body = {"origin": "SEA", "destination": "NRT", "departDate": "2026-08-01",
            "returnDate": None, "trip": "one-way", "seat": "economy", "adults": 1}
    key = "SEA|NRT|2026-08-01|None|one-way|economy|1|None|None"
    parsed = flight_svc._results_from_html(MESSY_PROVIDER_HTML, "SEA", "NRT")
    multi_stop = next(result for result in parsed if result["stops"] == 2)
    stale_duplicate = {**multi_stop, "id": "stale-duplicate", "bookingUrl": None}
    cache.put(key, {
        "source": "google-flights (live)",
        "priceLevel": "low",
        "results": [multi_stop, stale_duplicate],
        "query": flight_svc._query_echo("SEA", "NRT", "2026-08-01", None, "one-way", "economy", 1),
        "bookingUrl": None,
    })

    r = client.post("/api/search", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["cached"] is True
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["id"] == "0"
    assert result["bookingUrl"].startswith("https://www.google.com/travel/flights")
    assert set(result["airlineCodes"]) >= {"F9", "JL"}
    assert [lo["airport"] for lo in result["layovers"]] == ["DEN", "LAX"]


def test_cached_provider_payload_is_filtered_by_max_stops_at_api_boundary():
    body = {"origin": "SEA", "destination": "NRT", "departDate": "2026-08-02",
            "returnDate": None, "trip": "one-way", "seat": "economy", "adults": 1, "maxStops": 0}
    key = "SEA|NRT|2026-08-02|None|one-way|economy|1|0|None"
    parsed = flight_svc._results_from_html(MESSY_PROVIDER_HTML, "SEA", "NRT")
    cache.put(key, {
        "source": "google-flights (live)",
        "priceLevel": "low",
        "results": parsed,
        "query": flight_svc._query_echo("SEA", "NRT", "2026-08-02", None, "one-way", "economy", 1, 0),
        "bookingUrl": None,
    })

    r = client.post("/api/search", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["cached"] is True
    assert data["query"]["maxStops"] == 0
    assert len(data["results"]) == 1
    assert data["results"][0]["stops"] == 0
    assert data["results"][0]["durationText"] == "10 hr 15 min"


def test_cached_provider_payload_is_filtered_by_airline_at_api_boundary():
    body = {"origin": "SEA", "destination": "NRT", "departDate": "2026-08-05",
            "returnDate": None, "trip": "one-way", "seat": "economy", "adults": 1, "airlineCode": "JL"}
    key = "SEA|NRT|2026-08-05|None|one-way|economy|1|None|JL"
    parsed = flight_svc._results_from_html(MESSY_PROVIDER_HTML, "SEA", "NRT")
    cache.put(key, {
        "source": "google-flights (live)",
        "priceLevel": "low",
        "results": parsed,
        "query": flight_svc._query_echo("SEA", "NRT", "2026-08-05", None, "one-way", "economy", 1, None, "JL"),
        "bookingUrl": None,
    })

    r = client.post("/api/search", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["cached"] is True
    assert data["query"]["airlineCode"] == "JL"
    assert len(data["results"]) == 1
    assert data["results"][0]["stops"] == 2
    assert "JL" in data["results"][0]["airlineCodes"]
