"""
Study management service
Handles CRUD operations for studies with GDPR/HIPAA compliance
"""
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from fastapi import HTTPException, status

from app.models.study_models import (
    Study, StudyCreate, StudyUpdate, StudyListItem,
    StudyShareRequest, PermissionLevel, ValidationStatus, SubmissionStatus
)
from app.services.audit_service import AuditService, AuditAction
from app.services.notification_service import NotificationService, NotificationType


class StudyService:
    """Service for managing studies with multi-user collaboration"""

    def __init__(self, db: Session, current_user_id: str):
        self.db = db
        self.current_user_id = current_user_id
        self.audit_service = AuditService(db)
        self.notification_service = NotificationService(db)

    def create_study(
        self,
        study_data: StudyCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Study:
        """
        Create a new study

        Args:
            study_data: Study creation data
            ip_address: User's IP address (for audit)
            user_agent: User's browser info (for audit)

        Returns:
            Created Study object

        Raises:
            HTTPException: If study creation fails
        """
        try:
            # Generate unique study ID
            study_id = f"STUDY-{datetime.utcnow().year}-{str(uuid.uuid4())[:8].upper()}"

            # Create study record
            study_dict = study_data.dict()
            study_dict.update({
                'id': study_id,
                'created_by': self.current_user_id,
                'created_at': datetime.utcnow(),
                'last_accessed_at': datetime.utcnow(),
            })

            # Insert into database (using raw SQL or SQLAlchemy ORM)
            # Note: Adapt this to your actual database connection method
            query = """
                INSERT INTO studies (
                    id, name, protocol_number, sponsor, therapeutic_area, phase,
                    description, created_by, created_at, last_accessed_at,
                    setup_complete, code_generated, validation_status, submission_status,
                    sdtm_version, adam_ig_version, meddra_version, is_deleted
                )
                VALUES (
                    :id, :name, :protocol_number, :sponsor, :therapeutic_area, :phase,
                    :description, :created_by, :created_at, :last_accessed_at,
                    FALSE, FALSE, 'not_started', 'not_ready',
                    :sdtm_version, :adam_ig_version, :meddra_version, FALSE
                )
                RETURNING *
            """

            result = self.db.execute(query, study_dict)
            self.db.commit()

            # Grant creator admin access
            self._grant_access(study_id, self.current_user_id, PermissionLevel.ADMIN)

            # Log audit trail
            self.audit_service.log(
                user_id=self.current_user_id,
                action=AuditAction.STUDY_CREATED,
                study_id=study_id,
                resource_type="study",
                resource_id=study_id,
                details={"name": study_data.name, "protocol": study_data.protocol_number},
                ip_address=ip_address,
                user_agent=user_agent
            )

            # Send notification
            self.notification_service.create(
                user_id=self.current_user_id,
                study_id=study_id,
                type=NotificationType.SUCCESS,
                title="Study Created",
                description=f"Study '{study_data.name}' has been created successfully."
            )

            # Fetch and return the created study
            return self.get_study(study_id)

        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create study: {str(e)}"
            )

    def get_study(self, study_id: str) -> Study:
        """
        Get study by ID with permission check

        Args:
            study_id: Study identifier

        Returns:
            Study object

        Raises:
            HTTPException: If study not found or access denied
        """
        # Check if user has access
        if not self._has_access(study_id, self.current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this study"
            )

        # Fetch study
        query = """
            SELECT * FROM studies
            WHERE id = :study_id AND is_deleted = FALSE
        """
        result = self.db.execute(query, {"study_id": study_id}).fetchone()

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study not found"
            )

        # Update last accessed time
        self._update_last_accessed(study_id)

        # Convert to Study model
        study = Study(**dict(result))

        # Load related data
        study.datasets = self._get_study_datasets(study_id)
        study.specifications = self._get_study_specifications(study_id)
        study.access_list = self._get_study_access_list(study_id)

        return study

    def list_studies(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        phase: Optional[str] = None,
        status: Optional[ValidationStatus] = None
    ) -> List[StudyListItem]:
        """
        List all studies accessible to current user

        Args:
            skip: Number of records to skip (pagination)
            limit: Max number of records to return
            search: Search term (name, protocol, sponsor)
            phase: Filter by study phase
            status: Filter by validation status

        Returns:
            List of StudyListItem objects
        """
        # Build query with filters
        query = """
            SELECT s.*, sa.permission as my_permission,
                   COUNT(DISTINCT sd.id) as datasets_count
            FROM studies s
            INNER JOIN study_access sa ON s.id = sa.study_id
            LEFT JOIN study_datasets sd ON s.id = sd.study_id
            WHERE sa.user_id = :user_id
              AND sa.is_active = TRUE
              AND s.is_deleted = FALSE
        """

        params = {"user_id": self.current_user_id}

        if search:
            query += """
              AND (
                  LOWER(s.name) LIKE :search
                  OR LOWER(s.protocol_number) LIKE :search
                  OR LOWER(s.sponsor) LIKE :search
              )
            """
            params["search"] = f"%{search.lower()}%"

        if phase:
            query += " AND s.phase = :phase"
            params["phase"] = phase

        if status:
            query += " AND s.validation_status = :status"
            params["status"] = status.value

        query += """
            GROUP BY s.id, sa.permission
            ORDER BY s.last_accessed_at DESC NULLS LAST, s.created_at DESC
            LIMIT :limit OFFSET :skip
        """

        params.update({"limit": limit, "skip": skip})

        results = self.db.execute(query, params).fetchall()

        return [StudyListItem(**dict(row)) for row in results]

    def update_study(
        self,
        study_id: str,
        study_update: StudyUpdate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Study:
        """
        Update study details

        Args:
            study_id: Study identifier
            study_update: Fields to update
            ip_address: User's IP address
            user_agent: User's browser info

        Returns:
            Updated Study object

        Raises:
            HTTPException: If update fails or access denied
        """
        # Check permission (editor or admin required)
        if not self._has_access(study_id, self.current_user_id, min_permission=PermissionLevel.EDITOR):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this study"
            )

        try:
            # Build update query dynamically
            update_fields = study_update.dict(exclude_unset=True)
            if not update_fields:
                return self.get_study(study_id)

            set_clause = ", ".join([f"{key} = :{key}" for key in update_fields.keys()])
            query = f"""
                UPDATE studies
                SET {set_clause}, updated_at = :updated_at
                WHERE id = :study_id
            """

            params = {**update_fields, "study_id": study_id, "updated_at": datetime.utcnow()}
            self.db.execute(query, params)
            self.db.commit()

            # Log audit trail
            self.audit_service.log(
                user_id=self.current_user_id,
                action=AuditAction.STUDY_UPDATED,
                study_id=study_id,
                resource_type="study",
                resource_id=study_id,
                details={"updated_fields": list(update_fields.keys())},
                ip_address=ip_address,
                user_agent=user_agent
            )

            return self.get_study(study_id)

        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update study: {str(e)}"
            )

    def delete_study(
        self,
        study_id: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """
        Soft delete a study (GDPR/HIPAA compliant)

        Args:
            study_id: Study identifier
            ip_address: User's IP address
            user_agent: User's browser info

        Returns:
            True if successful

        Raises:
            HTTPException: If deletion fails or access denied
        """
        # Check permission (admin required)
        if not self._has_access(study_id, self.current_user_id, min_permission=PermissionLevel.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this study"
            )

        try:
            # Soft delete
            query = """
                UPDATE studies
                SET is_deleted = TRUE, deleted_at = :deleted_at
                WHERE id = :study_id
            """
            self.db.execute(query, {"study_id": study_id, "deleted_at": datetime.utcnow()})
            self.db.commit()

            # Log audit trail
            self.audit_service.log(
                user_id=self.current_user_id,
                action=AuditAction.STUDY_DELETED,
                study_id=study_id,
                resource_type="study",
                resource_id=study_id,
                details={"soft_delete": True},
                ip_address=ip_address,
                user_agent=user_agent
            )

            # Send notification to all users with access
            access_list = self._get_study_access_list(study_id)
            for access in access_list:
                self.notification_service.create(
                    user_id=access.user_id,
                    study_id=study_id,
                    type=NotificationType.WARNING,
                    title="Study Deleted",
                    description=f"Study {study_id} has been deleted."
                )

            return True

        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete study: {str(e)}"
            )

    def share_study(
        self,
        study_id: str,
        share_request: StudyShareRequest
    ) -> Dict[str, Any]:
        """
        Share study with other users

        Args:
            study_id: Study identifier
            share_request: Share request with user IDs and permission

        Returns:
            Dict with share results

        Raises:
            HTTPException: If sharing fails or access denied
        """
        # Check permission (admin required)
        if not self._has_access(study_id, self.current_user_id, min_permission=PermissionLevel.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to share this study"
            )

        try:
            shared_with = []
            for user_id in share_request.user_ids:
                # Grant access
                self._grant_access(study_id, user_id, share_request.permission)
                shared_with.append(user_id)

                # Send notification if requested
                if share_request.notify_users:
                    self.notification_service.create(
                        user_id=user_id,
                        study_id=study_id,
                        type=NotificationType.INFO,
                        title="Study Shared With You",
                        description=f"You now have {share_request.permission} access to study {study_id}.",
                        link=f"/studies/{study_id}"
                    )

            # Log audit trail
            self.audit_service.log(
                user_id=self.current_user_id,
                action=AuditAction.STUDY_SHARED,
                study_id=study_id,
                resource_type="study",
                resource_id=study_id,
                details={"shared_with": shared_with, "permission": share_request.permission.value}
            )

            return {
                "success": True,
                "study_id": study_id,
                "shared_with": shared_with,
                "permission": share_request.permission
            }

        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to share study: {str(e)}"
            )

    # Private helper methods
    def _has_access(
        self,
        study_id: str,
        user_id: str,
        min_permission: PermissionLevel = PermissionLevel.VIEWER
    ) -> bool:
        """Check if user has access to study with minimum permission level"""
        query = """
            SELECT permission FROM study_access
            WHERE study_id = :study_id
              AND user_id = :user_id
              AND is_active = TRUE
        """
        result = self.db.execute(query, {"study_id": study_id, "user_id": user_id}).fetchone()

        if not result:
            return False

        # Check permission level
        user_permission = result[0]
        permission_hierarchy = {
            PermissionLevel.VIEWER: 1,
            PermissionLevel.EDITOR: 2,
            PermissionLevel.ADMIN: 3
        }

        return permission_hierarchy.get(user_permission, 0) >= permission_hierarchy.get(min_permission, 0)

    def _grant_access(self, study_id: str, user_id: str, permission: PermissionLevel):
        """Grant user access to study"""
        query = """
            INSERT INTO study_access (study_id, user_id, permission, granted_by, granted_at, is_active)
            VALUES (:study_id, :user_id, :permission, :granted_by, :granted_at, TRUE)
            ON CONFLICT (study_id, user_id) DO UPDATE
            SET permission = :permission, granted_by = :granted_by, is_active = TRUE
        """
        self.db.execute(query, {
            "study_id": study_id,
            "user_id": user_id,
            "permission": permission.value,
            "granted_by": self.current_user_id,
            "granted_at": datetime.utcnow()
        })
        self.db.commit()

    def _update_last_accessed(self, study_id: str):
        """Update study's last accessed timestamp"""
        query = """
            UPDATE studies
            SET last_accessed_at = :accessed_at
            WHERE id = :study_id
        """
        self.db.execute(query, {"study_id": study_id, "accessed_at": datetime.utcnow()})
        self.db.commit()

    def _get_study_datasets(self, study_id: str) -> List[Dict[str, Any]]:
        """Get datasets for a study"""
        query = """
            SELECT * FROM study_datasets
            WHERE study_id = :study_id
            ORDER BY created_at DESC
        """
        results = self.db.execute(query, {"study_id": study_id}).fetchall()
        return [dict(row) for row in results]

    def _get_study_specifications(self, study_id: str) -> List[Dict[str, Any]]:
        """Get specifications for a study"""
        query = """
            SELECT * FROM study_specifications
            WHERE study_id = :study_id
            ORDER BY uploaded_at DESC
        """
        results = self.db.execute(query, {"study_id": study_id}).fetchall()
        return [dict(row) for row in results]

    def _get_study_access_list(self, study_id: str) -> List[Dict[str, Any]]:
        """Get access list for a study"""
        query = """
            SELECT * FROM study_access
            WHERE study_id = :study_id AND is_active = TRUE
            ORDER BY granted_at DESC
        """
        results = self.db.execute(query, {"study_id": study_id}).fetchall()
        return [dict(row) for row in results]
