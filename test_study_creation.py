"""
Test script for verifying study creation end-to-end
Tests study creation, retrieval, and database operations
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.models.db_models import Base, StudyDB, StudyAccessDB, UserDB
from app.core.auth import get_password_hash
from datetime import datetime
import uuid


async def test_study_creation():
    """Test study creation and retrieval"""

    # Create async engine
    DATABASE_URL = "sqlite+aiosqlite:///backend/adam_ai.db"
    engine = create_async_engine(DATABASE_URL, echo=True)

    # Create session
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        print("\n=== Testing Study Creation ===\n")

        # 0. Cleanup existing test user
        print("0. Cleaning up existing test data...")
        from sqlalchemy import delete, select
        # Delete existing test user
        stmt = delete(UserDB).where(UserDB.email == "test@example.com")
        await session.execute(stmt)
        await session.commit()
        print("   [OK] Cleaned up existing test data")

        # 1. Create a test user
        print("\n1. Creating test user...")
        test_user = UserDB(
            id=f"user-test-{uuid.uuid4().hex[:8]}",
            username="testuser",
            email="test@example.com",
            full_name="Test User",
            hashed_password=get_password_hash("testpass123"),
            is_active=True,
            role="statistician"
        )
        session.add(test_user)
        await session.commit()
        print(f"   [OK] Created user: {test_user.username} (ID: {test_user.id})")

        # 2. Create a test study
        print("\n2. Creating test study...")
        study_id = f"study-{uuid.uuid4().hex[:12]}"
        test_study = StudyDB(
            id=study_id,
            name="Test Study - Async Verification",
            protocol_number="ASYNC-TEST-001",
            sponsor="Test Pharma Inc",
            phase="Phase 3",
            therapeutic_area="Oncology",
            description="Testing AsyncSession implementation",
            created_by=test_user.username,
            created_at=datetime.utcnow(),
            setup_complete=False,
            code_generated=False,
            validation_status="not_started",
            submission_status="not_ready",
            is_deleted=False
        )
        session.add(test_study)
        await session.commit()
        print(f"   [OK] Created study: {test_study.name} (ID: {test_study.id})")

        # 3. Grant access to the user
        print("\n3. Granting admin access...")
        access = StudyAccessDB(
            study_id=study_id,
            user_id=test_user.id,
            permission="admin",
            granted_by=test_user.username,
            granted_at=datetime.utcnow(),
            is_active=True
        )
        session.add(access)
        await session.commit()
        print(f"   [OK] Granted admin access to user: {test_user.username}")

        # 4. Retrieve the study
        print("\n4. Retrieving study...")
        from sqlalchemy import select
        stmt = select(StudyDB).where(StudyDB.id == study_id)
        result = await session.execute(stmt)
        retrieved_study = result.scalar_one_or_none()

        if retrieved_study:
            print(f"   [OK] Retrieved study: {retrieved_study.name}")
            print(f"     - Protocol: {retrieved_study.protocol_number}")
            print(f"     - Sponsor: {retrieved_study.sponsor}")
            print(f"     - Phase: {retrieved_study.phase}")
            print(f"     - Created by: {retrieved_study.created_by}")
        else:
            print("   [FAIL] Failed to retrieve study")
            return False

        # 5. Verify access
        print("\n5. Verifying study access...")
        from sqlalchemy import text
        access_query = text("""
            SELECT permission FROM study_access
            WHERE study_id = :study_id AND user_id = :user_id AND is_active = TRUE
        """)
        access_result = await session.execute(
            access_query,
            {"study_id": study_id, "user_id": test_user.id}
        )
        permission = access_result.scalar_one_or_none()

        if permission:
            print(f"   [OK] User has '{permission}' permission")
        else:
            print("   [FAIL] No access found")
            return False

        # 6. List studies for user
        print("\n6. Listing studies for user...")
        list_query = text("""
            SELECT s.*, sa.permission as my_permission
            FROM studies s
            INNER JOIN study_access sa ON s.id = sa.study_id
            WHERE sa.user_id = :user_id
              AND sa.is_active = TRUE
              AND s.is_deleted = FALSE
            ORDER BY s.created_at DESC
        """)
        list_result = await session.execute(list_query, {"user_id": test_user.id})
        studies = list_result.fetchall()

        print(f"   [OK] Found {len(studies)} study(ies)")
        for study in studies:
            print(f"     - {study.name} ({study.my_permission})")

        print("\n=== ALL TESTS PASSED ===\n")
        return True


if __name__ == "__main__":
    result = asyncio.run(test_study_creation())
    sys.exit(0 if result else 1)
