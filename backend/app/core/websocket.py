"""
WebSocket connection manager for real-time notifications
"""
from typing import Dict, List
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)


class NotificationManager:
    """
    Manages WebSocket connections for real-time notifications

    Features:
    - Multiple connections per user (different devices/tabs)
    - Auto-cleanup on disconnect
    - Broadcast to specific user
    - Connection health monitoring
    """

    def __init__(self):
        # user_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        logger.info("NotificationManager initialized")

    async def connect(self, user_id: str, websocket: WebSocket):
        """
        Accept and register a new WebSocket connection

        Args:
            user_id: User identifier
            websocket: WebSocket connection
        """
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: str, websocket: WebSocket):
        """
        Remove WebSocket connection on disconnect

        Args:
            user_id: User identifier
            websocket: WebSocket connection to remove
        """
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
                logger.info(f"User {user_id} disconnected. Remaining connections: {len(self.active_connections[user_id])}")

                # Clean up if no more connections
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                    logger.info(f"All connections closed for user {user_id}")

            except ValueError:
                # Connection already removed
                pass

    async def send_to_user(self, user_id: str, message: dict):
        """
        Send message to all active connections for a user

        Args:
            user_id: User identifier
            message: Message dictionary to send (will be JSON-serialized)
        """
        if user_id not in self.active_connections:
            logger.debug(f"No active connections for user {user_id}")
            return

        # Convert message to JSON
        message_json = json.dumps(message, default=str)

        # Send to all connections
        dead_connections = []

        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(message_json)
                logger.debug(f"Sent notification to user {user_id}")
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                dead_connections.append(websocket)

        # Clean up dead connections
        for websocket in dead_connections:
            self.disconnect(user_id, websocket)

    async def broadcast(self, message: dict):
        """
        Broadcast message to all connected users

        Args:
            message: Message dictionary to broadcast
        """
        message_json = json.dumps(message, default=str)
        dead_connections = []

        for user_id, connections in self.active_connections.items():
            for websocket in connections:
                try:
                    await websocket.send_text(message_json)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")
                    dead_connections.append((user_id, websocket))

        # Clean up dead connections
        for user_id, websocket in dead_connections:
            self.disconnect(user_id, websocket)

    def get_active_users(self) -> List[str]:
        """Get list of user IDs with active connections"""
        return list(self.active_connections.keys())

    def get_connection_count(self, user_id: str = None) -> int:
        """
        Get number of active connections

        Args:
            user_id: Optional user ID to get count for specific user

        Returns:
            Connection count
        """
        if user_id:
            return len(self.active_connections.get(user_id, []))

        return sum(len(conns) for conns in self.active_connections.values())


# Global instance
notification_manager = NotificationManager()
