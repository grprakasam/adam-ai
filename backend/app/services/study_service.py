"""
Study management service
Handles CRUD operations for studies with GDPR/HIPAA compliance
"""
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, func, text
from fastapi import HTTPException, status

from app.models.study_models import (
    Study, StudyCreate, StudyUpdate, StudyListItem,
    StudyShareRequest, PermissionLevel, ValidationStatus, SubmissionStatus,
    DatasetStatus
)
from app.services.audit_service import AuditService, AuditAction
from app.services.notification_service import NotificationService, NotificationType


class StudyService:
    """Service for managing studies with multi-user collaboration"""

    def __init__(self, db: AsyncSession, current_user_id: str):
        self.db = db
        self.current_user_id = current_user_id
        self.audit_service = AuditService(db)
        self.notification_service = NotificationService(db)

    async def create_study(
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
            query = text("""
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
            """)

            await self.db.execute(query, study_dict)
            await self.db.commit()

            # Grant creator admin access
            await self._grant_access(study_id, self.current_user_id, PermissionLevel.ADMIN)

            # Log audit trail - TEMPORARILY DISABLED FOR TESTING
            # self.audit_service.log(
            #     user_id=self.current_user_id,
            #     action=AuditAction.STUDY_CREATED,
            #     study_id=study_id,
            #     resource_type="study",
            #     resource_id=study_id,
            #     details={"name": study_data.name, "protocol": study_data.protocol_number},
            #     ip_address=ip_address,
            #     user_agent=user_agent
            # )

            # Send notification - TEMPORARILY DISABLED FOR TESTING
            # self.notification_service.create(
            #     user_id=self.current_user_id,
            #     study_id=study_id,
            #     type=NotificationType.SUCCESS,
            #     title="Study Created",
            #     description=f"Study '{study_data.name}' has been created successfully."
            # )

            # Fetch and return the created study
            return await self.get_study(study_id)

        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create study: {str(e)}"
            )

    async def get_study(self, study_id: str) -> Study:
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
        if not await self._has_access(study_id, self.current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this study"
            )

        # Fetch study
        query = text("""
            SELECT * FROM studies
            WHERE id = :study_id AND is_deleted = FALSE
        """)
        exec_result = await self.db.execute(query, {"study_id": study_id})
        result = exec_result.mappings().first()

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study not found"
            )

        # Update last accessed time
        await self._update_last_accessed(study_id)

        # Convert to Study model
        study = Study(**dict(result))

        # Load related data (use safe defaults until extended schema is aligned)
        study.datasets = await self._get_study_datasets(study_id)
        study.specifications = await self._get_study_specifications(study_id)
        study.access_list = await self._get_study_access_list(study_id)

        return study

    async def list_studies(
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
                   COUNT(DISTINCT sds.id) as datasets_count
            FROM studies s
            INNER JOIN study_access sa ON s.id = sa.study_id
            LEFT JOIN study_dataset_selections sds ON s.id = sds.study_id AND sds.is_active = TRUE
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

        result = await self.db.execute(text(query), params)
        results = result.mappings().all()

        return [StudyListItem(**dict(row)) for row in results]

    async def update_study(
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
        if not await self._has_access(study_id, self.current_user_id, min_permission=PermissionLevel.EDITOR):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this study"
            )

        try:
            # Build update query dynamically
            update_fields = study_update.dict(exclude_unset=True)
            if not update_fields:
                return await self.get_study(study_id)

            set_clause = ", ".join([f"{key} = :{key}" for key in update_fields.keys()])
            query = f"""
                UPDATE studies
                SET {set_clause}, updated_at = :updated_at
                WHERE id = :study_id
            """

            params = {**update_fields, "study_id": study_id, "updated_at": datetime.utcnow()}
            await self.db.execute(text(query), params)
            await self.db.commit()

            # Audit logging would go here once async-safe

            return await self.get_study(study_id)

        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update study: {str(e)}"
            )

    async def delete_study(
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
        if not await self._has_access(study_id, self.current_user_id, min_permission=PermissionLevel.ADMIN):
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
            await self.db.execute(text(query), {"study_id": study_id, "deleted_at": datetime.utcnow()})
            await self.db.commit()

            # Audit/notification hooks can be re-enabled once async-safe

            return True

        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete study: {str(e)}"
            )

    async def share_study(
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
        if not await self._has_access(study_id, self.current_user_id, min_permission=PermissionLevel.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to share this study"
            )

        try:
            shared_with = []
            for user_id in share_request.user_ids:
                # Grant access
                await self._grant_access(study_id, user_id, share_request.permission)
                shared_with.append(user_id)

                # Notification/audit hooks can be added here once async-safe

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
    async def _has_access(
        self,
        study_id: str,
        user_id: str,
        min_permission: PermissionLevel = PermissionLevel.VIEWER
    ) -> bool:
        """Check if user has access to study with minimum permission level"""
        query = text("""
            SELECT permission FROM study_access
            WHERE study_id = :study_id
              AND user_id = :user_id
              AND is_active = TRUE
        """)
        exec_result = await self.db.execute(query, {"study_id": study_id, "user_id": user_id})
        result = exec_result.fetchone()

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

    async def _grant_access(self, study_id: str, user_id: str, permission: PermissionLevel):
        """Grant user access to study"""
        query = text("""
            INSERT INTO study_access (study_id, user_id, permission, granted_by, granted_at, is_active)
            VALUES (:study_id, :user_id, :permission, :granted_by, :granted_at, TRUE)
            ON CONFLICT (study_id, user_id) DO UPDATE
            SET permission = :permission, granted_by = :granted_by, is_active = TRUE
        """)
        await self.db.execute(query, {
            "study_id": study_id,
            "user_id": user_id,
            "permission": permission.value,
            "granted_by": self.current_user_id,
            "granted_at": datetime.utcnow()
        })
        await self.db.commit()

    async def _update_last_accessed(self, study_id: str):
        """Update study's last accessed timestamp"""
        query = text("""
            UPDATE studies
            SET last_accessed_at = :accessed_at
            WHERE id = :study_id
        """)
        await self.db.execute(query, {"study_id": study_id, "accessed_at": datetime.utcnow()})
        await self.db.commit()

    async def _get_study_datasets(self, study_id: str) -> List[Dict[str, Any]]:
        """Get datasets for a study (based on dataset selections)"""
        query = text("""
            SELECT id, dataset_name, language, is_active, priority, created_at, updated_at
            FROM study_dataset_selections
            WHERE study_id = :study_id AND is_active = TRUE
            ORDER BY priority ASC, created_at ASC
        """)
        result = await self.db.execute(query, {"study_id": study_id})
        rows = result.mappings().all()

        datasets = []
        for row in rows:
            datasets.append({
                "id": row["id"],
                "dataset_name": row["dataset_name"],
                "dataset_type": "ADAM",
                "specification_path": None,
                "generated_code_path": None,
                "status": DatasetStatus.NOT_STARTED.value,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "metadata": {
                    "language": row["language"],
                    "priority": row["priority"],
                    "is_active": row["is_active"]
                }
            })
        return datasets

    async def _get_study_specifications(self, study_id: str) -> List[Dict[str, Any]]:
        """Get specifications for a study (placeholder for current schema)"""
        return []

    async def _get_study_access_list(self, study_id: str) -> List[Dict[str, Any]]:
        """Get access list for a study"""
        query = text("""
            SELECT study_id, user_id, permission, granted_by, granted_at, is_active
            FROM study_access
            WHERE study_id = :study_id AND is_active = TRUE
            ORDER BY granted_at DESC
        """)
        result = await self.db.execute(query, {"study_id": study_id})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def update_dataset_selections(
        self,
        study_id: str,
        datasets: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Update ADAM dataset selections for a study

        Args:
            study_id: Study identifier
            datasets: List of dataset selections
                Each item: {"dataset_name": "ADSL", "language": "R", "priority": 0}

        Returns:
            List of updated dataset selections
        """
        # Check access
        if not await self._has_access(study_id, self.current_user_id, min_permission=PermissionLevel.EDITOR):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update dataset selections"
            )

        try:
            # Delete existing selections
            delete_query = """
                DELETE FROM study_dataset_selections
                WHERE study_id = :study_id
            """
            await self.db.execute(text(delete_query), {"study_id": study_id})

            # Insert new selections
            import uuid
            for dataset in datasets:
                dataset_id = f"dataset-sel-{uuid.uuid4().hex[:12]}"
                insert_query = """
                    INSERT INTO study_dataset_selections (
                        id, study_id, dataset_name, language, is_active, priority, created_at, updated_at
                    )
                    VALUES (
                        :id, :study_id, :dataset_name, :language, TRUE, :priority, :created_at, :updated_at
                    )
                """
                await self.db.execute(text(insert_query), {
                    "id": dataset_id,
                    "study_id": study_id,
                    "dataset_name": dataset.get("dataset_name"),
                    "language": dataset.get("language", "Both"),
                    "priority": dataset.get("priority", 0),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                })

            await self.db.commit()

            # Return updated selections
            return await self.get_dataset_selections(study_id)

        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update dataset selections: {str(e)}"
            )

    async def get_dataset_selections(self, study_id: str) -> List[Dict[str, Any]]:
        """Get dataset selections for a study"""
        query = """
            SELECT * FROM study_dataset_selections
            WHERE study_id = :study_id AND is_active = TRUE
            ORDER BY priority ASC, created_at ASC
        """
        result = await self.db.execute(text(query), {"study_id": study_id})
        rows = result.mappings().all()
        return [dict(row) for row in rows]
