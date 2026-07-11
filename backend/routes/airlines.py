"""Airline experience-card endpoint."""
from fastapi import APIRouter, HTTPException

from services import flights as flight_svc

router = APIRouter()


@router.get("/api/airlines/{iata}")
def airline(iata: str):
    card = flight_svc.airline_card(iata)
    if not card:
        raise HTTPException(status_code=404, detail=f"No curated data for '{iata.upper()}'")
    return card
