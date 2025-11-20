"""
Database Configuration and Session Management
PostgreSQL with async SQLAlchemy 2.0

Features:
- Async database operations
- Connection pooling
- Session management
- Database health checks
"""

from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, text
from loguru import logger
import os


# Database URL from environment
# Default to SQLite for development (works on all platforms)
# For production, set DATABASE_URL to PostgreSQL connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///adam_ai.db"  # SQLite file database
)

# For testing, use in-memory SQLite
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


class DatabaseManager:
    """
    Manages database connection, sessions, and lifecycle

    Implements:
    - Connection pooling
    - Session management
    - Health checks
    - Graceful shutdown
    """

    def __init__(self, database_url: Optional[str] = None, echo: bool = False):
        """
        Initialize database manager

        Args:
            database_url: Database connection URL (defaults to env var)
            echo: Enable SQL logging for debugging
        """
        self.database_url = database_url or DATABASE_URL
        self.echo = echo
        self.engine: Optional[AsyncEngine] = None
        self.session_factory: Optional[async_sessionmaker] = None

    async def initialize(self):
        """Initialize database engine and session factory"""
        logger.info(f"Initializing database connection: {self._safe_url()}")

        # Create async engine with connection pooling
        self.engine = create_async_engine(
            self.database_url,
            echo=self.echo,
            pool_size=20,  # Production-grade connection pool
            max_overflow=10,
            pool_pre_ping=True,  # Verify connections before using
            pool_recycle=3600,  # Recycle connections after 1 hour
        )

        # Create session factory
        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )

        logger.info("Database initialization complete")

    async def create_all_tables(self):
        """Create all database tables (development only)"""
        if not self.engine:
            await self.initialize()

        logger.info("Creating all database tables")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created")

    async def drop_all_tables(self):
        """Drop all database tables (development/testing only)"""
        if not self.engine:
            await self.initialize()

        logger.warning("Dropping all database tables")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        logger.info("Database tables dropped")

    async def health_check(self) -> bool:
        """
        Check database connectivity

        Returns:
            True if database is accessible, False otherwise
        """
        if not self.engine:
            return False

        try:
            async with self.engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    async def close(self):
        """Close database connections gracefully"""
        if self.engine:
            logger.info("Closing database connections")
            await self.engine.dispose()
            logger.info("Database connections closed")

    def _safe_url(self) -> str:
        """Return database URL with password masked"""
        if "@" in self.database_url:
            parts = self.database_url.split("@")
            return f"***@{parts[-1]}"
        return self.database_url

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """
        Get database session with automatic cleanup

        Usage:
            async with db_manager.get_session() as session:
                result = await session.execute(select(User))
                users = result.scalars().all()
        """
        if not self.session_factory:
            await self.initialize()

        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise


# Global database manager instance
db_manager = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions

    Usage in FastAPI routes:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    async with db_manager.get_session() as session:
        yield session


async def init_db():
    """Initialize database on application startup"""
    await db_manager.initialize()

    # In development, create tables automatically
    if os.getenv("ENVIRONMENT", "development") == "development":
        await db_manager.create_all_tables()


async def close_db():
    """Close database on application shutdown"""
    await db_manager.close()
