"""
Study management API endpoints
Provides CRUD operations and collaboration features for studies
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.study_models import (
    Study, StudyCreate, StudyUpdate, StudyListItem, StudyShareRequest,
    APIResponse, PaginatedResponse, ValidationStatus
)
from app.services.study_service import StudyService
from app.core.database import get_db
from app.core.auth import get_current_user, get_current_active_user, User


router = APIRouter(prefix="/studies", tags=["Studies"])


def get_study_service(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> StudyService:
    """Dependency to get StudyService instance"""
    return StudyService(db, current_user.username)


@router.post("", response_model=Study, status_code=status.HTTP_201_CREATED)
async def create_study(
    study_data: StudyCreate,
    request: Request,
    study_service: StudyService = Depends(get_study_service)
):
    """
    Create a new study

    The creator automatically gets admin access.
    """
    study = await study_service.create_study(
        study_data,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    return study


@router.get("", response_model=List[StudyListItem])
async def list_studies(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    search: Optional[str] = Query(None, description="Search term (name, protocol, sponsor)"),
    phase: Optional[str] = Query(None, description="Filter by study phase"),
    status: Optional[ValidationStatus] = Query(None, description="Filter by validation status"),
    study_service: StudyService = Depends(get_study_service)
):
    """
    List all studies accessible to current user

    Supports:
    - Pagination (skip, limit)
    - Search by name, protocol, sponsor
    - Filter by phase and validation status
    """
    studies = await study_service.list_studies(
        skip=skip,
        limit=limit,
        search=search,
        phase=phase,
        status=status
    )
    return studies


@router.get("/{study_id}", response_model=Study)
async def get_study(
    study_id: str,
    study_service: StudyService = Depends(get_study_service)
):
    """
    Get study details by ID

    Includes:
    - Study metadata
    - Datasets list
    - Specifications list
    - Access list (who has access)
    """
    study = await study_service.get_study(study_id)
    return study


@router.put("/{study_id}", response_model=Study)
async def update_study(
    study_id: str,
    study_update: StudyUpdate,
    request: Request,
    study_service: StudyService = Depends(get_study_service)
):
    """
    Update study details

    Requires editor or admin permission.
    """
    study = await study_service.update_study(
        study_id,
        study_update,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    return study


@router.delete("/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study(
    study_id: str,
    request: Request,
    study_service: StudyService = Depends(get_study_service)
):
    """
    Delete a study (soft delete)

    Requires admin permission.
    GDPR compliant - study data is marked as deleted but retained per retention policy.
    """
    await study_service.delete_study(
        study_id,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    return None


@router.post("/{study_id}/share", response_model=APIResponse)
async def share_study(
    study_id: str,
    share_request: StudyShareRequest,
    study_service: StudyService = Depends(get_study_service)
):
    """
    Share study with other users

    Requires admin permission.
    Users receive notification if notify_users=true.
    """
    result = await study_service.share_study(study_id, share_request)
    return APIResponse(
        success=True,
        message=f"Study shared with {len(result['shared_with'])} users",
        data=result
    )


@router.post("/{study_id}/access", status_code=status.HTTP_204_NO_CONTENT)
async def track_study_access(
    study_id: str,
    study_service: StudyService = Depends(get_study_service)
):
    """
    Track that user accessed this study
    Updates last_accessed_at timestamp
    """
    await study_service._update_last_accessed(study_id)
    return None


@router.get("/recent", response_model=List[StudyListItem])
async def get_recent_studies(
    limit: int = Query(5, ge=1, le=20, description="Number of recent studies"),
    study_service: StudyService = Depends(get_study_service)
):
    """
    Get user's recently accessed studies
    """
    studies = await study_service.list_studies(skip=0, limit=limit)
    return studies


@router.get("/{study_id}/specifications")
async def get_study_specifications(
    study_id: str,
    study_service: StudyService = Depends(get_study_service)
):
    """Get all specifications for a study"""
    # Check access first
    await study_service.get_study(study_id)
    specifications = await study_service._get_study_specifications(study_id)
    return {"specifications": specifications}


@router.get("/{study_id}/access-list")
async def get_study_access_list(
    study_id: str,
    study_service: StudyService = Depends(get_study_service)
):
    """Get list of users with access to this study"""
    # Check access first (admin only)
    await study_service.get_study(study_id)
    access_list = await study_service._get_study_access_list(study_id)
    return {"access_list": access_list}


@router.put("/{study_id}/datasets")
async def update_datasets(
    study_id: str,
    datasets: dict,  # {"datasets": [{"dataset_name": "ADSL", "language": "R", "priority": 0}]}
    study_service: StudyService = Depends(get_study_service)
):
    """Update ADAM dataset selections for a study"""
    datasets_list = datasets.get("datasets", [])
    result = await study_service.update_dataset_selections(study_id, datasets_list)
    return {"datasets": result}


@router.get("/{study_id}/datasets")
async def get_datasets(
    study_id: str,
    study_service: StudyService = Depends(get_study_service)
):
    """Get current dataset selections for a study"""
    datasets = await study_service.get_dataset_selections(study_id)
    return {"datasets": datasets}
