"""Flight search endpoint (cached)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services import cache
from services import flights as flight_svc

router = APIRouter()


class SearchRequest(BaseModel):
    origin: str = Field(min_length=3, max_length=3)
    destination: str = Field(min_length=3, max_length=3)
    departDate: str
    returnDate: Optional[str] = None
    trip: str = "one-way"  # "one-way" | "round-trip"
    seat: str = "economy"  # economy | premium-economy | business | first
    adults: int = 1
    maxStops: Optional[int] = Field(default=None, ge=0, le=2)
    airlineCode: Optional[str] = Field(default=None, min_length=2, max_length=3, pattern=r"^[A-Za-z0-9]+$")


@router.post("/api/search")
def search(req: SearchRequest):
    if req.origin.upper() == req.destination.upper():
        raise HTTPException(status_code=400, detail="Origin and destination must differ.")
    trip = "round-trip" if (req.trip == "round-trip" and req.returnDate) else "one-way"
    airline_code = req.airlineCode.upper() if req.airlineCode else None
    # Normalize casing so "jfk" and "JFK" share one cache entry (the service
    # upper-cases internally, so they compute the identical result anyway).
    key = (
        f"{req.origin.upper()}|{req.destination.upper()}|{req.departDate}"
        f"|{req.returnDate}|{trip}|{req.seat.lower()}|{req.adults}|{req.maxStops}|{airline_code}"
    )

    cached = cache.get(key)
    if cached is not None:
        cleaned = flight_svc.sanitize_search_response(
            cached,
            origin=req.origin, destination=req.destination,
            depart_date=req.departDate, return_date=req.returnDate,
            trip=trip, seat=req.seat, adults=req.adults,
            max_stops=req.maxStops, airline_code=airline_code,
        )
        return {**cleaned, "cached": True}

    try:
        result = flight_svc.search(
            origin=req.origin, destination=req.destination,
            depart_date=req.departDate, return_date=req.returnDate,
            trip=trip, seat=req.seat, adults=req.adults,
            max_stops=req.maxStops, airline_code=airline_code,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Search failed: {exc}")

    result = flight_svc.sanitize_search_response(
        result,
        origin=req.origin, destination=req.destination,
        depart_date=req.departDate, return_date=req.returnDate,
        trip=trip, seat=req.seat, adults=req.adults,
        max_stops=req.maxStops, airline_code=airline_code,
    )
    cache.put(key, result)
    return {**result, "cached": False}
