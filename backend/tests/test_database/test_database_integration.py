"""
Database Integration Tests
Tests for database connectivity, models, and operations
"""

import pytest
from datetime import datetime
from sqlalchemy import select
from passlib.context import CryptContext

from app.core.database import db_manager
from app.models.db_models import (
    UserDB,
    AuditEntryDB,
    ElectronicSignatureDB,
    CodeSnippetDB,
    DatasetDB,
    VariableDB
)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="module")
async def setup_test_db():
    """Setup test database"""
    # Use in-memory SQLite for testing
    db_manager.database_url = "sqlite+aiosqlite:///:memory:"

    await db_manager.initialize()
    await db_manager.create_all_tables()

    yield

    await db_manager.close()


class TestDatabaseConnection:
    """Test database connectivity"""

    @pytest.mark.asyncio
    async def test_database_health_check(self, setup_test_db):
        """Test database health check"""
        is_healthy = await db_manager.health_check()
        assert is_healthy is True

    @pytest.mark.asyncio
    async def test_database_session(self, setup_test_db):
        """Test database session creation"""
        async with db_manager.get_session() as session:
            assert session is not None


class TestUserModel:
    """Test User model operations"""

    @pytest.mark.asyncio
    async def test_create_user(self, setup_test_db):
        """Test creating a user"""
        async with db_manager.get_session() as session:
            user = UserDB(
                id="test-user-001",
                username="testuser",
                email="test@example.com",
                full_name="Test User",
                hashed_password=pwd_context.hash("TestPass@123"),
                role="statistician",
                permissions={"create_code": True}
            )

            session.add(user)
            await session.commit()

            # Verify user was created
            result = await session.execute(
                select(UserDB).where(UserDB.username == "testuser")
            )
            created_user = result.scalar_one_or_none()

            assert created_user is not None
            assert created_user.username == "testuser"
            assert created_user.email == "test@example.com"
            assert created_user.is_active is True

    @pytest.mark.asyncio
    async def test_user_unique_constraints(self, setup_test_db):
        """Test user unique constraints"""
        async with db_manager.get_session() as session:
            # Try to create duplicate user
            duplicate_user = UserDB(
                id="test-user-002",
                username="testuser",  # Same username
                email="different@example.com",
                full_name="Another User",
                hashed_password=pwd_context.hash("Pass@123")
            )

            session.add(duplicate_user)

            with pytest.raises(Exception):  # Should raise integrity error
                await session.commit()


class TestAuditTrailModel:
    """Test Audit Trail model operations"""

    @pytest.mark.asyncio
    async def test_create_audit_entry(self, setup_test_db):
        """Test creating audit entry"""
        async with db_manager.get_session() as session:
            # First create a user
            user = UserDB(
                id="audit-user-001",
                username="audituser",
                email="audit@example.com",
                full_name="Audit User",
                hashed_password=pwd_context.hash("Pass@123")
            )
            session.add(user)
            await session.commit()

            # Create audit entry
            audit_entry = AuditEntryDB(
                audit_id="audit-001",
                timestamp=datetime.utcnow(),
                user_id="audit-user-001",
                username="audituser",
                action="USER_LOGIN",
                previous_hash=None,
                current_hash="abc123def456"
            )

            session.add(audit_entry)
            await session.commit()

            # Verify audit entry
            result = await session.execute(
                select(AuditEntryDB).where(AuditEntryDB.audit_id == "audit-001")
            )
            created_entry = result.scalar_one_or_none()

            assert created_entry is not None
            assert created_entry.action == "USER_LOGIN"
            assert created_entry.username == "audituser"

    @pytest.mark.asyncio
    async def test_audit_trail_hash_chain(self, setup_test_db):
        """Test audit trail hash chain"""
        async with db_manager.get_session() as session:
            # Create first entry
            entry1 = AuditEntryDB(
                audit_id="audit-chain-001",
                timestamp=datetime.utcnow(),
                user_id="audit-user-001",
                username="audituser",
                action="CODE_GENERATION_STARTED",
                previous_hash=None,
                current_hash="hash001"
            )
            session.add(entry1)
            await session.commit()

            # Create second entry linked to first
            entry2 = AuditEntryDB(
                audit_id="audit-chain-002",
                timestamp=datetime.utcnow(),
                user_id="audit-user-001",
                username="audituser",
                action="CODE_SNIPPET_CREATED",
                previous_hash="hash001",  # Links to entry1
                current_hash="hash002"
            )
            session.add(entry2)
            await session.commit()

            # Verify chain
            result = await session.execute(
                select(AuditEntryDB).where(AuditEntryDB.audit_id == "audit-chain-002")
            )
            entry = result.scalar_one_or_none()

            assert entry.previous_hash == "hash001"
            assert entry.current_hash == "hash002"


class TestDatasetAndVariableModels:
    """Test Dataset and Variable models"""

    @pytest.mark.asyncio
    async def test_create_dataset_with_variables(self, setup_test_db):
        """Test creating dataset with variables"""
        async with db_manager.get_session() as session:
            # Create dataset
            dataset = DatasetDB(
                id="dataset-adsl",
                name="ADSL",
                label="Subject-Level Analysis Dataset",
                structure="One record per subject",
                created_by="audit-user-001"
            )
            session.add(dataset)
            await session.commit()

            # Create variable
            variable = VariableDB(
                id="var-usubjid",
                name="USUBJID",
                label="Unique Subject Identifier",
                dataset_id="dataset-adsl",
                variable_type="Char",
                origin="Predecessor"
            )
            session.add(variable)
            await session.commit()

            # Verify dataset and variable
            result = await session.execute(
                select(DatasetDB).where(DatasetDB.name == "ADSL")
            )
            created_dataset = result.scalar_one_or_none()

            assert created_dataset is not None
            assert created_dataset.name == "ADSL"

            # Check variable
            var_result = await session.execute(
                select(VariableDB).where(VariableDB.name == "USUBJID")
            )
            created_var = var_result.scalar_one_or_none()

            assert created_var is not None
            assert created_var.dataset_id == "dataset-adsl"


class TestCodeSnippetModel:
    """Test Code Snippet model"""

    @pytest.mark.asyncio
    async def test_create_code_snippet(self, setup_test_db):
        """Test creating code snippet"""
        async with db_manager.get_session() as session:
            snippet = CodeSnippetDB(
                id="snippet-001",
                code="AGEGR1 <- ifelse(AGE < 18, 'Child', 'Adult')",
                language="R",
                variable_name="AGEGR1",
                variable_label="Age Group 1",
                llm_provider="groq",
                model_name="llama-3-70b",
                validation_status="passed",
                created_by="audit-user-001"
            )

            session.add(snippet)
            await session.commit()

            # Verify snippet
            result = await session.execute(
                select(CodeSnippetDB).where(CodeSnippetDB.id == "snippet-001")
            )
            created_snippet = result.scalar_one_or_none()

            assert created_snippet is not None
            assert created_snippet.variable_name == "AGEGR1"
            assert created_snippet.language == "R"


class TestElectronicSignatureModel:
    """Test Electronic Signature model"""

    @pytest.mark.asyncio
    async def test_create_electronic_signature(self, setup_test_db):
        """Test creating electronic signature"""
        async with db_manager.get_session() as session:
            signature = ElectronicSignatureDB(
                signature_id="sig-001",
                user_id="audit-user-001",
                username="audituser",
                full_name="Audit User",
                signed_at=datetime.utcnow(),
                signature_meaning="APPROVED",
                reason="Approval of code snippet for regulatory submission",
                resource_type="code_snippet",
                resource_id="snippet-001",
                signature_hash="sig_hash_123",
                document_hash="doc_hash_456"
            )

            session.add(signature)
            await session.commit()

            # Verify signature
            result = await session.execute(
                select(ElectronicSignatureDB).where(
                    ElectronicSignatureDB.signature_id == "sig-001"
                )
            )
            created_sig = result.scalar_one_or_none()

            assert created_sig is not None
            assert created_sig.signature_meaning == "APPROVED"
            assert created_sig.is_valid is True
            assert created_sig.revoked is False

    @pytest.mark.asyncio
    async def test_signature_reason_constraint(self, setup_test_db):
        """Test signature reason minimum length constraint"""
        async with db_manager.get_session() as session:
            # Try to create signature with short reason
            signature = ElectronicSignatureDB(
                signature_id="sig-002",
                user_id="audit-user-001",
                username="audituser",
                full_name="Audit User",
                signed_at=datetime.utcnow(),
                signature_meaning="APPROVED",
                reason="OK",  # Too short - should violate constraint
                resource_type="code_snippet",
                resource_id="snippet-001",
                signature_hash="sig_hash_123",
                document_hash="doc_hash_456"
            )

            session.add(signature)

            # In SQLite, check constraints may not be enforced the same way as PostgreSQL
            # This test validates the model structure
            with pytest.raises(Exception):
                await session.commit()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
