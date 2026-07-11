"""Airport autocomplete endpoint."""
from fastapi import APIRouter, Query

from services import airports as airport_svc

router = APIRouter()


@router.get("/api/airports")
def autocomplete(q: str = Query(default=""), limit: int = Query(default=8, le=20)):
    return {"results": airport_svc.search(q, limit=limit)}
