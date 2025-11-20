"""
Notification service for real-time user notifications
Supports in-app notifications with WebSocket push
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.study_models import (
    Notification, NotificationCreate, NotificationType
)


class NotificationService:
    """Service for managing user notifications"""

    def __init__(self, db: Session):
        self.db = db
        self.websocket_manager = None  # Will be set later for real-time push

    def create(
        self,
        user_id: str,
        type: NotificationType,
        title: str,
        description: Optional[str] = None,
        study_id: Optional[str] = None,
        link: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """
        Create a new notification

        Args:
            user_id: User ID to notify
            type: Notification type (success, warning, error, info, task)
            title: Notification title
            description: Detailed description
            study_id: Related study ID
            link: URL to navigate to
            metadata: Additional data

        Returns:
            Created Notification object
        """
        query = """
            INSERT INTO notifications (
                user_id, study_id, type, title, description,
                link, read, created_at, metadata
            )
            VALUES (
                :user_id, :study_id, :type, :title, :description,
                :link, FALSE, :created_at, :metadata
            )
            RETURNING *
        """

        import json
        result = self.db.execute(query, {
            "user_id": user_id,
            "study_id": study_id,
            "type": type.value,
            "title": title,
            "description": description,
            "link": link,
            "created_at": datetime.utcnow(),
            "metadata": json.dumps(metadata) if metadata else None
        })

        self.db.commit()
        notification = Notification(**dict(result.fetchone()))

        # Push to WebSocket if available
        if self.websocket_manager:
            self.websocket_manager.send_to_user(user_id, notification.dict())

        return notification

    def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        study_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Notification]:
        """
        Get notifications for a user

        Args:
            user_id: User ID
            unread_only: Return only unread notifications
            study_id: Filter by study
            skip: Pagination offset
            limit: Max results

        Returns:
            List of Notification objects
        """
        query = "SELECT * FROM notifications WHERE user_id = :user_id"
        params = {"user_id": user_id}

        if unread_only:
            query += " AND read = FALSE"

        if study_id:
            query += " AND study_id = :study_id"
            params["study_id"] = study_id

        query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
        params.update({"limit": limit, "skip": skip})

        results = self.db.execute(query, params).fetchall()

        return [Notification(**dict(row)) for row in results]

    def mark_as_read(self, notification_id: int, user_id: str) -> bool:
        """
        Mark notification as read

        Args:
            notification_id: Notification ID
            user_id: User ID (for security check)

        Returns:
            True if successful
        """
        query = """
            UPDATE notifications
            SET read = TRUE, read_at = :read_at
            WHERE id = :notification_id AND user_id = :user_id
        """

        result = self.db.execute(query, {
            "notification_id": notification_id,
            "user_id": user_id,
            "read_at": datetime.utcnow()
        })

        self.db.commit()

        return result.rowcount > 0

    def mark_all_as_read(self, user_id: str, study_id: Optional[str] = None) -> int:
        """
        Mark all notifications as read for a user

        Args:
            user_id: User ID
            study_id: Optional study filter

        Returns:
            Number of notifications marked as read
        """
        query = """
            UPDATE notifications
            SET read = TRUE, read_at = :read_at
            WHERE user_id = :user_id AND read = FALSE
        """
        params = {"user_id": user_id, "read_at": datetime.utcnow()}

        if study_id:
            query += " AND study_id = :study_id"
            params["study_id"] = study_id

        result = self.db.execute(query, params)
        self.db.commit()

        return result.rowcount

    def get_unread_count(self, user_id: str) -> int:
        """
        Get count of unread notifications

        Args:
            user_id: User ID

        Returns:
            Count of unread notifications
        """
        query = """
            SELECT COUNT(*) FROM notifications
            WHERE user_id = :user_id AND read = FALSE
        """

        result = self.db.execute(query, {"user_id": user_id}).fetchone()

        return result[0] if result else 0

    def delete_old_notifications(self, days: int = 90) -> int:
        """
        Delete notifications older than specified days
        (For GDPR/data retention compliance)

        Args:
            days: Age threshold in days

        Returns:
            Number of notifications deleted
        """
        query = """
            DELETE FROM notifications
            WHERE created_at < NOW() - INTERVAL ':days days'
        """

        result = self.db.execute(query, {"days": days})
        self.db.commit()

        return result.rowcount

    def set_websocket_manager(self, manager):
        """
        Set WebSocket manager for real-time push

        Args:
            manager: WebSocket manager instance
        """
        self.websocket_manager = manager
