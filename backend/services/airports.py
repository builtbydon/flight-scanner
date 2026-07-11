"""Load and index the OpenFlights worldwide airport dataset.

The dataset (backend/data/airports.dat) is a header-less CSV with columns:
    0 id, 1 name, 2 city, 3 country, 4 IATA, 5 ICAO, 6 lat, 7 lon, ...
Provides coordinate lookup (for the map) and fast autocomplete search.
"""
from __future__ import annotations

import csv
import os
import re
import unicodedata
from functools import lru_cache
from typing import Optional


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


# Generic words that don't help distinguish one airport from another.
_STOP = {"airport", "international", "intl", "regional", "municipal", "airfield", "field"}

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "airports.dat")


class Airport:
    __slots__ = ("iata", "name", "city", "country", "lat", "lon")

    def __init__(self, iata: str, name: str, city: str, country: str, lat: float, lon: float):
        self.iata = iata
        self.name = name
        self.city = city
        self.country = country
        self.lat = lat
        self.lon = lon

    def to_dict(self) -> dict:
        return {
            "iata": self.iata,
            "name": self.name,
            "city": self.city,
            "country": self.country,
            "lat": self.lat,
            "lon": self.lon,
            "label": f"{self.city} ({self.iata}) · {self.name}",
        }


@lru_cache(maxsize=1)
def _index() -> dict[str, Airport]:
    airports: dict[str, Airport] = {}
    with open(os.path.abspath(_DATA_PATH), newline="", encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if len(row) < 8:
                continue
            iata = row[4].strip().upper()
            if not iata or iata == "\\N" or len(iata) != 3:
                continue
            try:
                lat, lon = float(row[6]), float(row[7])
            except (ValueError, IndexError):
                continue
            airports[iata] = Airport(iata, row[1], row[2], row[3], lat, lon)
    return airports


def get(iata: str) -> Optional[Airport]:
    if not iata:
        return None
    return _index().get(iata.strip().upper())


@lru_cache(maxsize=1)
def _name_city_index() -> tuple[dict, dict]:
    by_name: dict[str, Airport] = {}
    by_city: dict[str, list[Airport]] = {}
    for ap in _index().values():
        by_name.setdefault(_norm(ap.name), ap)
        by_city.setdefault(_norm(ap.city), []).append(ap)
    return by_name, by_city


def match(name: str, city: str = "") -> Optional[Airport]:
    """Resolve a Google-style airport name (+ city) to an Airport with coords.

    Used to turn layover descriptions like 'Zurich Airport in Zürich' into a
    plottable point. Tries: exact normalized name -> distinctive-token subset
    -> city fallback.
    """
    by_name, by_city = _name_city_index()
    n = _norm(name)
    if n in by_name:
        return by_name[n]

    # Distinctive tokens (drop generic words like "airport"/"international").
    tokens = [t for t in n.split() if t not in _STOP]
    if tokens:
        best = None
        for ap in _index().values():
            an = _norm(ap.name)
            if all(t in an for t in tokens):
                # Prefer the shortest matching name (most specific).
                if best is None or len(an) < len(_norm(best.name)):
                    best = ap
        if best:
            return best

    # City fallback: prefer an "international" airport in that city.
    cands = by_city.get(_norm(city), [])
    if cands:
        intl = [a for a in cands if "international" in a.name.lower()]
        return (intl or cands)[0]
    return None


def search(query: str, limit: int = 8) -> list[dict]:
    """Autocomplete over IATA code, city, and airport name."""
    q = (query or "").strip().lower()
    if not q:
        return []
    exact, prefix, contains = [], [], []
    for ap in _index().values():
        code = ap.iata.lower()
        city = ap.city.lower()
        name = ap.name.lower()
        if code == q:
            exact.append(ap)
        elif code.startswith(q) or city.startswith(q) or name.startswith(q):
            prefix.append(ap)
        elif q in city or q in name:
            contains.append(ap)
        if len(exact) + len(prefix) >= limit * 3:
            break
    ranked = (exact + prefix + contains)[:limit]
    return [ap.to_dict() for ap in ranked]
