"""Regression tests for bugs found in the multi-agent audit.

Each test here would have failed before its corresponding fix.
"""
import os

os.environ["FLIGHT_SCANNER_MOCK"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

import main as M  # noqa: E402
from main import app  # noqa: E402
from routes import destination as D  # noqa: E402
from services import flights as F  # noqa: E402

client = TestClient(app)


# ------------------------------------------------ path traversal (HIGH) ---
def test_static_file_blocks_path_traversal():
    # Real files that live outside the dist dir must never be served.
    assert M._safe_static_file("../../backend/main.py") is None
    assert M._safe_static_file("../../../../../../etc/passwd") is None
    assert M._safe_static_file("..%2f..%2fmain.py") is None
    assert M._safe_static_file("") is None


def test_static_file_serves_contained_file(tmp_path, monkeypatch):
    dist = os.path.realpath(str(tmp_path))
    monkeypatch.setattr(M, "_FRONTEND_DIST", dist)
    (tmp_path / "app.js").write_text("ok")
    assert M._safe_static_file("app.js") == os.path.join(dist, "app.js")
    # ...but a traversal out of the (patched) dist still resolves to None.
    assert M._safe_static_file("../escape.txt") is None


# --------------------------------------------- deal-level buckets (LOW) ---
def test_deal_levels_typical_is_reachable_on_small_sets():
    # Before the fix, everything <= median was "low", so on a 2-item set the
    # pricier flight was mislabeled "low" and "typical" almost never appeared.
    results = [{"priceValue": 100.0}, {"priceValue": 500.0}]
    F._apply_deal_levels(results, None)
    assert results[0]["dealLevel"] == "low"      # cheapest
    assert results[1]["dealLevel"] == "typical"  # not "low"


def test_deal_levels_flags_expensive_outlier_high():
    results = [{"priceValue": 100.0}, {"priceValue": 110.0}, {"priceValue": 900.0}]
    F._apply_deal_levels(results, None)
    levels = [r["dealLevel"] for r in results]
    assert levels[0] == "low"
    assert levels[2] == "high"


# -------------------------------- wikipedia geosearch KeyError (MED) ------
def test_geosearch_tolerates_missing_title():
    items = [
        {"title": "Space Needle", "dist": 1200, "pageid": 123},
        {"dist": 800},  # malformed row: no 'title'
        {"title": "Pike Place Market", "dist": 500, "pageid": 456},
    ]
    attractions = D._geosearch_attractions(items)
    names = [a["name"] for a in attractions]
    # The bad row is skipped; the good rows survive (previously one KeyError
    # nuked the entire list).
    assert names == ["Pike Place Market", "Space Needle"]
    assert attractions[0]["url"] == "https://en.wikipedia.org/?curid=456"


def test_geosearch_filters_low_signal_events_and_keeps_page_links():
    items = [
        {"title": "2017 Example attack", "dist": 200, "pageid": 10},
        {"title": "Central Station", "dist": 300, "pageid": 11},
        {"title": "Example High School", "dist": 400, "pageid": 12},
        {"title": "City Art Museum", "dist": 900, "pageid": 13},
        {"title": "Old Harbor Market", "dist": 700, "pageid": 14},
    ]

    attractions = D._geosearch_attractions(items)

    assert [a["name"] for a in attractions] == ["Old Harbor Market", "City Art Museum"]
    assert all(a["url"].startswith("https://en.wikipedia.org/?curid=") for a in attractions)


# ---------------------------------- cache key normalization (MED) ---------
def test_search_cache_key_is_case_insensitive():
    lower = {"origin": "lax", "destination": "nrt", "departDate": "2027-03-01",
             "returnDate": None, "trip": "one-way", "seat": "economy", "adults": 1}
    upper = {**lower, "origin": "LAX", "destination": "NRT"}
    assert client.post("/api/search", json=lower).json()["cached"] is False
    # Same search, different casing -> should hit the same cache entry.
    assert client.post("/api/search", json=upper).json()["cached"] is True
