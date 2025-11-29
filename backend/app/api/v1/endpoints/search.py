"""
Global search API endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.study_models import SearchResult, SearchResponse, SearchType
from app.services.search_service import SearchService
from app.core.database import get_db
from app.core.auth import get_current_active_user, User
import time


router = APIRouter(prefix="/search", tags=["Search"])


def get_search_service(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> SearchService:
    """Dependency to get SearchService instance"""
    return SearchService(db, current_user.id)


@router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    study_id: Optional[str] = Query(None, description="Filter by study"),
    types: Optional[List[SearchType]] = Query(None, description="Filter by types"),
    limit: int = Query(50, ge=1, le=200, description="Max results"),
    search_service: SearchService = Depends(get_search_service)
):
    """
    Global search across variables, code, studies, datasets, help

    Search targets:
    - Variable names and labels
    - Code snippets and comments
    - Study names and protocols
    - Dataset names
    - Help articles

    Features:
    - Full-text search with relevance scoring
    - Type filtering
    - Study scoping
    - Keyboard shortcut: Ctrl+K / Cmd+K (frontend)
    """
    start_time = time.time()

    results = search_service.search(
        query=q,
        study_id=study_id,
        types=types,
        limit=limit
    )

    took_ms = int((time.time() - start_time) * 1000)

    return SearchResponse(
        query=q,
        results=results,
        total=len(results),
        took_ms=took_ms
    )


@router.get("/suggestions")
async def search_suggestions(
    q: str = Query(..., min_length=1, description="Partial search query"),
    limit: int = Query(10, ge=1, le=50, description="Max suggestions"),
    search_service: SearchService = Depends(get_search_service)
):
    """
    Get search suggestions as user types

    Returns quick suggestions for autocomplete
    """
    suggestions = search_service.get_suggestions(q, limit)
    return {"suggestions": suggestions}


@router.get("/recent")
async def get_recent_searches(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_active_user)
):
    """Get user's recent search queries"""
    # TODO: Implement recent searches tracking
    # For now, return empty
    return {"recent_searches": []}
