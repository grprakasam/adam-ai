"""
Database Initialization and Seeding
Creates default users and initial data
"""

import asyncio
from datetime import datetime
from passlib.context import CryptContext
from loguru import logger

from app.core.database import db_manager
from app.models.db_models import UserDB
from sqlalchemy import select


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_default_users():
    """Create default admin and test users"""
    logger.info("Creating default users...")

    async with db_manager.get_session() as session:
        # Check if admin already exists
        result = await session.execute(
            select(UserDB).where(UserDB.username == "admin")
        )
        existing_admin = result.scalar_one_or_none()

        if existing_admin:
            logger.info("Admin user already exists, skipping creation")
            return

        # Create admin user
        admin_user = UserDB(
            id="user-admin",
            username="admin",
            email="admin@adamai.com",
            full_name="System Administrator",
            hashed_password=pwd_context.hash("Admin@123"),
            is_active=True,
            is_admin=True,
            role="admin",
            permissions={
                "create_code": True,
                "approve_code": True,
                "manage_users": True,
                "sign_documents": True,
                "view_audit_trail": True,
                "generate_define_xml": True
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            password_changed_at=datetime.utcnow()
        )
        session.add(admin_user)

        # Create statistician user
        statistician_user = UserDB(
            id="user-stat001",
            username="statistician",
            email="statistician@adamai.com",
            full_name="Test Statistician",
            hashed_password=pwd_context.hash("Stat@123"),
            is_active=True,
            is_admin=False,
            role="statistician",
            permissions={
                "create_code": True,
                "approve_code": False,
                "manage_users": False,
                "sign_documents": True,
                "view_audit_trail": True,
                "generate_define_xml": False
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            password_changed_at=datetime.utcnow()
        )
        session.add(statistician_user)

        # Create programmer user
        programmer_user = UserDB(
            id="user-prog001",
            username="programmer",
            email="programmer@adamai.com",
            full_name="Test Programmer",
            hashed_password=pwd_context.hash("Prog@123"),
            is_active=True,
            is_admin=False,
            role="programmer",
            permissions={
                "create_code": True,
                "approve_code": True,
                "manage_users": False,
                "sign_documents": True,
                "view_audit_trail": False,
                "generate_define_xml": True
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            password_changed_at=datetime.utcnow()
        )
        session.add(programmer_user)

        await session.commit()
        logger.info("✅ Created 3 default users: admin, statistician, programmer")
        logger.info("   Admin password: Admin@123")
        logger.info("   Statistician password: Stat@123")
        logger.info("   Programmer password: Prog@123")


async def init_database():
    """
    Initialize database with tables and default data

    Steps:
    1. Initialize database connection
    2. Create all tables (in development)
    3. Seed default users
    """
    logger.info("=" * 70)
    logger.info("DATABASE INITIALIZATION")
    logger.info("=" * 70)

    try:
        # Initialize database connection
        await db_manager.initialize()
        logger.info("✅ Database connection initialized")

        # Create all tables
        await db_manager.create_all_tables()
        logger.info("✅ Database tables created")

        # Create default users
        await create_default_users()

        logger.info("=" * 70)
        logger.info("✅ DATABASE INITIALIZATION COMPLETE")
        logger.info("=" * 70)

    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise


async def reset_database():
    """
    DANGER: Drop all tables and recreate
    Only use in development!
    """
    logger.warning("=" * 70)
    logger.warning("⚠️  RESETTING DATABASE - ALL DATA WILL BE LOST")
    logger.warning("=" * 70)

    try:
        await db_manager.initialize()

        # Drop all tables
        await db_manager.drop_all_tables()
        logger.warning("⚠️  All tables dropped")

        # Recreate tables
        await db_manager.create_all_tables()
        logger.info("✅ Tables recreated")

        # Seed default data
        await create_default_users()

        logger.info("=" * 70)
        logger.info("✅ DATABASE RESET COMPLETE")
        logger.info("=" * 70)

    except Exception as e:
        logger.error(f"❌ Database reset failed: {e}")
        raise


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "reset":
        asyncio.run(reset_database())
    else:
        asyncio.run(init_database())
