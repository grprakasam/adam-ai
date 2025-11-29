"""
Notification API endpoints
Provides notification management and WebSocket support
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session

from app.models.study_models import Notification, APIResponse
from app.services.notification_service import NotificationService
from app.core.database import get_db
from app.core.auth import get_current_active_user, verify_websocket_token, User
from app.core.websocket import notification_manager


router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_notification_service(db: Session = Depends(get_db)) -> NotificationService:
    """Dependency to get NotificationService instance"""
    service = NotificationService(db)
    service.set_websocket_manager(notification_manager)
    return service


@router.get("", response_model=List[Notification])
async def get_notifications(
    unread_only: bool = Query(False, description="Return only unread notifications"),
    study_id: Optional[str] = Query(None, description="Filter by study"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service)
):
    """
    Get notifications for current user

    Supports:
    - Filter by unread status
    - Filter by study
    - Pagination
    """
    notifications = notification_service.get_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        study_id=study_id,
        skip=skip,
        limit=limit
    )
    return notifications


@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service)
):
    """Mark a notification as read"""
    success = notification_service.mark_as_read(notification_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return None


@router.put("/read-all", response_model=APIResponse)
async def mark_all_notifications_read(
    study_id: Optional[str] = Query(None, description="Mark all in study (optional)"),
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service)
):
    """Mark all notifications as read for current user"""
    count = notification_service.mark_all_as_read(current_user.id, study_id)
    return APIResponse(
        success=True,
        message=f"Marked {count} notifications as read",
        data={"count": count}
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service)
):
    """Get count of unread notifications"""
    count = notification_service.get_unread_count(current_user.id)
    return {"unread_count": count}


# WebSocket endpoint for real-time notifications
@router.websocket("/ws")
async def notifications_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="Authentication token")
):
    """
    WebSocket endpoint for real-time notifications

    Usage:
    ```javascript
    const ws = new WebSocket(`ws://localhost:8000/api/v1/notifications/ws?token=${token}`);
    ws.onmessage = (event) => {
        const notification = JSON.parse(event.data);
        console.log('New notification:', notification);
    };
    ```
    """
    # Verify token and get user
    user = await verify_websocket_token(token)
    if not user:
        await websocket.close(code=1008, reason="Invalid token")
        return

    # Accept connection
    await notification_manager.connect(user.id, websocket)

    try:
        # Keep connection alive
        while True:
            # Receive (and ignore) any messages from client
            # This keeps the connection open
            data = await websocket.receive_text()

            # Optional: Handle ping/pong for connection health
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        notification_manager.disconnect(user.id, websocket)
