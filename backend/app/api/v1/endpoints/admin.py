"""
Admin API endpoints
Accessible only to users with admin role
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.study_models import (
    AuditLogEntry, AuditLogFilter, Template, TemplateCreate, TemplateUpdate,
    APIResponse, AuditAction
)
from app.services.audit_service import AuditService
from app.core.database import get_db
from app.core.auth import get_current_admin_user, User


router = APIRouter(prefix="/admin", tags=["Admin"])


def get_audit_service(db: Session = Depends(get_db)) -> AuditService:
    """Dependency to get AuditService instance"""
    return AuditService(db)


# ============================================================================
# AUDIT LOGS
# ============================================================================

@router.get("/audit-logs", response_model=List[AuditLogEntry])
async def get_audit_logs(
    user_id: Optional[str] = Query(None, description="Filter by user"),
    study_id: Optional[str] = Query(None, description="Filter by study"),
    action: Optional[AuditAction] = Query(None, description="Filter by action"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_admin: User = Depends(get_current_admin_user),
    audit_service: AuditService = Depends(get_audit_service)
):
    """
    Get audit logs with filters (admin only)

    21 CFR Part 11 compliant audit trail
    """
    filters = AuditLogFilter(
        user_id=user_id,
        study_id=study_id,
        action=action,
        resource_type=resource_type,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )

    logs = audit_service.get_logs(filters, is_admin=True)
    return logs


@router.get("/audit-logs/export")
async def export_audit_logs(
    format: str = Query("csv", regex="^(csv|json)$", description="Export format"),
    user_id: Optional[str] = None,
    study_id: Optional[str] = None,
    action: Optional[AuditAction] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_admin: User = Depends(get_current_admin_user),
    audit_service: AuditService = Depends(get_audit_service)
):
    """
    Export audit logs to CSV or JSON (admin only)

    For regulatory submissions and compliance audits
    """
    filters = AuditLogFilter(
        user_id=user_id,
        study_id=study_id,
        action=action,
        start_date=start_date,
        end_date=end_date,
        skip=0,
        limit=10000  # Large limit for export
    )

    export_data = audit_service.export_logs(filters, format=format)

    # Set appropriate content type and headers
    media_type = "text/csv" if format == "csv" else "application/json"
    filename = f"audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{format}"

    return Response(
        content=export_data,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/audit-logs/{log_id}/verify")
async def verify_audit_log(
    log_id: int,
    current_admin: User = Depends(get_current_admin_user),
    audit_service: AuditService = Depends(get_audit_service)
):
    """
    Verify integrity of an audit log entry using checksum

    For compliance validation
    """
    is_valid = audit_service.verify_integrity(log_id)
    return {
        "log_id": log_id,
        "is_valid": is_valid,
        "verified_at": datetime.utcnow()
    }


# ============================================================================
# USER MANAGEMENT
# ============================================================================

@router.get("/users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str] = Query(None, description="Filter by role"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    List all users (admin only)

    Supports:
    - Pagination
    - Filter by role
    - Search by name/email
    """
    # TODO: Implement based on your User model
    query = "SELECT * FROM users WHERE 1=1"
    params = {}

    if role:
        query += " AND role = :role"
        params["role"] = role

    if search:
        query += " AND (LOWER(name) LIKE :search OR LOWER(email) LIKE :search)"
        params["search"] = f"%{search.lower()}%"

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
    params.update({"limit": limit, "skip": skip})

    results = db.execute(query, params).fetchall()
    users = [dict(row) for row in results]

    return {"users": users, "total": len(users)}


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str = Query(..., regex="^(viewer|editor|admin)$"),
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    audit_service: AuditService = Depends(get_audit_service)
):
    """
    Update user role (admin only)

    Roles: viewer, editor, admin
    """
    # Update user role
    query = "UPDATE users SET role = :role, updated_at = :updated_at WHERE id = :user_id"
    result = db.execute(query, {
        "user_id": user_id,
        "role": role,
        "updated_at": datetime.utcnow()
    })
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Log audit trail
    audit_service.log(
        user_id=current_admin.id,
        action=AuditAction.USER_ROLE_CHANGED,
        resource_type="user",
        resource_id=user_id,
        details={"new_role": role}
    )

    return {"success": True, "user_id": user_id, "new_role": role}


@router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    audit_service: AuditService = Depends(get_audit_service)
):
    """Deactivate user account (admin only)"""
    query = "UPDATE users SET is_active = FALSE, updated_at = :updated_at WHERE id = :user_id"
    result = db.execute(query, {
        "user_id": user_id,
        "updated_at": datetime.utcnow()
    })
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Log audit trail
    audit_service.log(
        user_id=current_admin.id,
        action=AuditAction.USER_ROLE_CHANGED,  # Or create USER_DEACTIVATED
        resource_type="user",
        resource_id=user_id,
        details={"action": "deactivate"}
    )

    return {"success": True, "user_id": user_id, "is_active": False}


# ============================================================================
# TEMPLATE MANAGEMENT
# ============================================================================

@router.get("/templates", response_model=List[Template])
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all templates (admin only)"""
    query = "SELECT * FROM templates WHERE 1=1"
    params = {}

    if category:
        query += " AND category = :category"
        params["category"] = category

    if is_active is not None:
        query += " AND is_active = :is_active"
        params["is_active"] = is_active

    query += " ORDER BY created_at DESC"

    results = db.execute(query, params).fetchall()
    templates = [Template(**dict(row)) for row in results]

    return templates


@router.post("/templates", response_model=Template, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: TemplateCreate,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    audit_service: AuditService = Depends(get_audit_service)
):
    """Create new template (admin only)"""
    query = """
        INSERT INTO templates (
            name, category, subcategory, version, study_scoped,
            content, file_path, description, is_active,
            created_by, created_at
        )
        VALUES (
            :name, :category, :subcategory, :version, :study_scoped,
            :content, :file_path, :description, TRUE,
            :created_by, :created_at
        )
        RETURNING *
    """

    result = db.execute(query, {
        **template_data.dict(),
        "created_by": current_admin.id,
        "created_at": datetime.utcnow()
    })
    db.commit()

    template = Template(**dict(result.fetchone()))

    # Log audit trail
    audit_service.log(
        user_id=current_admin.id,
        action=AuditAction.TEMPLATE_CREATED,
        resource_type="template",
        resource_id=str(template.id),
        details={"name": template.name, "category": template.category.value}
    )

    return template


@router.put("/templates/{template_id}", response_model=Template)
async def update_template(
    template_id: int,
    template_update: TemplateUpdate,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    audit_service: AuditService = Depends(get_audit_service)
):
    """Update template (admin only)"""
    update_fields = template_update.dict(exclude_unset=True)
    if not update_fields:
        # Nothing to update, fetch and return existing
        query = "SELECT * FROM templates WHERE id = :template_id"
        result = db.execute(query, {"template_id": template_id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Template not found")
        return Template(**dict(result))

    set_clause = ", ".join([f"{key} = :{key}" for key in update_fields.keys()])
    query = f"""
        UPDATE templates
        SET {set_clause}, updated_at = :updated_at
        WHERE id = :template_id
        RETURNING *
    """

    result = db.execute(query, {
        **update_fields,
        "template_id": template_id,
        "updated_at": datetime.utcnow()
    })
    db.commit()

    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    template = Template(**dict(row))

    # Log audit trail
    audit_service.log(
        user_id=current_admin.id,
        action=AuditAction.TEMPLATE_UPDATED,
        resource_type="template",
        resource_id=str(template_id),
        details={"updated_fields": list(update_fields.keys())}
    )

    return template


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    audit_service: AuditService = Depends(get_audit_service)
):
    """Delete template (admin only)"""
    query = "DELETE FROM templates WHERE id = :template_id"
    result = db.execute(query, {"template_id": template_id})
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Template not found")

    # Log audit trail
    audit_service.log(
        user_id=current_admin.id,
        action=AuditAction.TEMPLATE_DELETED,
        resource_type="template",
        resource_id=str(template_id)
    )

    return None


# ============================================================================
# SYSTEM STATS & MONITORING
# ============================================================================

@router.get("/stats")
async def get_system_stats(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system statistics (admin only)"""
    # Count users
    users_count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    # Count studies
    studies_count = db.execute("SELECT COUNT(*) FROM studies WHERE is_deleted = FALSE").fetchone()[0]

    # Count active sessions
    active_sessions = db.execute(
        "SELECT COUNT(*) FROM user_sessions WHERE is_active = TRUE"
    ).fetchone()[0]

    # Recent activity (last 24 hours)
    recent_activity = db.execute("""
        SELECT COUNT(*) FROM audit_logs
        WHERE timestamp > NOW() - INTERVAL '24 hours'
    """).fetchone()[0]

    return {
        "users_count": users_count,
        "studies_count": studies_count,
        "active_sessions": active_sessions,
        "recent_activity_24h": recent_activity,
        "timestamp": datetime.utcnow()
    }
