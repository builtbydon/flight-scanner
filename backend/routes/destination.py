"""Destination info endpoint: Wikivoyage summary + Wikipedia nearby-places geosearch."""
from __future__ import annotations

import asyncio
import re
from urllib.parse import quote

import httpx
from cachetools import TTLCache
from fastapi import APIRouter, HTTPException

from services import airports as A

router = APIRouter()

_UA = "flight-scanner/1.0 (personal travel app; non-commercial)"
# Bounded + TTL so the cache can't grow unbounded and a transient upstream
# failure doesn't pin an empty result for an airport forever.
_CACHE: TTLCache = TTLCache(maxsize=512, ttl=86400)

# Patterns that suggest a Wikipedia article is a historical event, not a place to visit
_EVENT_RE = re.compile(
    r"\b\d{4}\b"                          # year like "1966" or "2017"
    r"|attack|riot|massacre|disaster|bombing|shooting"
    r"|accident|battle|crash|explosion|incident|protest|siege|war"
    r"|climate of|demographics of|economy of|politics of"
    r"|history of|flag of|coat of arms"
    r"|earthquake|flood|storm|hurricane|fire of|smog",
    re.IGNORECASE,
)
_ATTRACTION_RE = re.compile(
    r"\b(aquarium|arch|arena|beach|bridge|castle|cathedral|church|fort|fortress|gallery|garden|"
    r"harbou?r|landmark|market|memorial|monument|mosque|museum|observatory|opera|palace|park|"
    r"pier|plaza|shrine|square|stadium|synagogue|temple|theat(?:er|re)|tower|waterfront|zoo)\b"
    r"|needle",
    re.IGNORECASE,
)
_LOW_SIGNAL_RE = re.compile(
    r"\b(airport|bus|campus|college|county|district|hospital|interchange|line|municipality|"
    r"neighbou?rhood|road|route|school|station|street|suburb|university|ward)\b",
    re.IGNORECASE,
)


async def _wikivoyage(city: str, client: httpx.AsyncClient) -> dict:
    """Fetch Wikivoyage page summary; retries with '{city} (city)' on disambiguation."""
    for slug in [city.replace(" ", "_"), city.replace(" ", "_") + "_(city)"]:
        try:
            r = await client.get(
                f"https://en.wikivoyage.org/api/rest_v1/page/summary/{slug}",
                headers={"User-Agent": _UA},
                timeout=8,
            )
            if r.status_code == 200:
                d = r.json()
                summary = d.get("extract", "")
                # Skip disambiguation pages
                if "more than one place" in summary or "may refer to" in summary:
                    continue
                return {
                    "summary": summary,
                    "url": d.get("content_urls", {}).get("desktop", {}).get("page", ""),
                    "thumbnail": d.get("thumbnail", {}).get("source", ""),
                }
        except Exception:
            pass
    return {}


async def _city_coords(city: str, country: str, client: httpx.AsyncClient) -> tuple[float, float] | None:
    """Geocode city center via Nominatim (OpenStreetMap). Falls back to None on error."""
    try:
        r = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"city": city, "country": country, "format": "json", "limit": 1},
            headers={"User-Agent": _UA},
            timeout=6,
        )
        if r.status_code == 200:
            results = r.json()
            if results:
                return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        pass
    return None


async def _wiki_nearby(lat: float, lon: float, client: httpx.AsyncClient) -> list[dict]:
    """Wikipedia geosearch: notable places within 10 km of given coordinates."""
    try:
        r = await client.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "geosearch",
                "gscoord": f"{lat}|{lon}",
                "gsradius": 10000,
                "gslimit": 12,
                "format": "json",
            },
            headers={"User-Agent": _UA},
            timeout=8,
        )
        if r.status_code == 200:
            items = r.json().get("query", {}).get("geosearch", [])
            return _geosearch_attractions(items)
    except Exception:
        pass
    return []


def _geosearch_attractions(items: list[dict]) -> list[dict]:
    """Filter Wikipedia geosearch rows into attractions, tolerating bad rows.

    A single malformed item (e.g. missing 'title') must be skipped, not allowed
    to raise and wipe out the whole nearby-places list.
    """
    results = []
    for item in items:
        title = item.get("title")
        if not title or _EVENT_RE.search(title):
            continue
        if _LOW_SIGNAL_RE.search(title) or not _ATTRACTION_RE.search(title):
            continue
        pageid = item.get("pageid")
        url = f"https://en.wikipedia.org/?curid={pageid}" if pageid else (
            "https://en.wikipedia.org/wiki/" + quote(title.replace(" ", "_"), safe="()_,")
        )
        dist_km = round(item.get("dist", 0) / 1000, 1)
        results.append({
            "name": title,
            "type": "attraction",
            "distKm": dist_km,
            "url": url,
        })
    return sorted(results, key=lambda x: x["distKm"])[:8]


@router.get("/api/destination/{iata}")
async def destination(iata: str):
    iata = iata.strip().upper()
    cached = _CACHE.get(iata)
    if cached is not None:
        return {**cached, "cached": True}

    airport = A.get(iata)
    if not airport:
        raise HTTPException(status_code=404, detail=f"Airport '{iata}' not found")

    async with httpx.AsyncClient() as client:
        wv, city_coords = await asyncio.gather(
            _wikivoyage(airport.city, client),
            _city_coords(airport.city, airport.country, client),
        )
        # Search near city center (not airport) so results are actually in town
        search_lat, search_lon = city_coords if city_coords else (airport.lat, airport.lon)
        nearby = await _wiki_nearby(search_lat, search_lon, client)

    result: dict = {
        "iata": iata,
        "city": airport.city,
        "country": airport.country,
        "summary": wv.get("summary", ""),
        "wikivoyageUrl": wv.get("url", ""),
        "thumbnail": wv.get("thumbnail", ""),
        "attractions": nearby,
    }
    # Only cache genuinely useful results — otherwise a transient Wikivoyage /
    # Nominatim failure would be pinned for the whole TTL with no recovery.
    if result["summary"] or result["attractions"]:
        _CACHE[iata] = result
    return {**result, "cached": False}
