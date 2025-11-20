"""
Tests for Electronic Signature Service
21 CFR Part 11 Compliance Testing
"""

import pytest
from datetime import datetime
import asyncio

from app.services.electronic_signature_service import (
    ElectronicSignatureService,
    SignatureManifestationService,
    get_electronic_signature_service
)
from app.models.compliance import SignatureMeaning


class TestElectronicSignatureService:
    """Test suite for electronic signature functionality"""

    @pytest.fixture
    def signature_service(self):
        """Get signature service instance"""
        return ElectronicSignatureService()

    @pytest.fixture
    def sample_document(self):
        """Sample document to sign"""
        return {
            "code_snippet_id": "snippet-123",
            "variable_name": "AGEGR1",
            "code": "AGEGR1 <- ifelse(AGE < 18, 'Child', 'Adult')",
            "language": "R",
            "status": "generated"
        }

    @pytest.mark.asyncio
    async def test_create_signature_success(self, signature_service, sample_document):
        """Test successful signature creation"""
        signature = await signature_service.create_signature(
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            reason="Approval of age grouping derivation for Study ABC-123",
            password="secure_password",
            document_content=sample_document,
            ip_address="192.168.1.100"
        )

        # Verify signature created
        assert signature is not None
        assert signature.signature_id is not None
        assert signature.username == "jdoe"
        assert signature.full_name == "John Doe"
        assert signature.signature_meaning == SignatureMeaning.APPROVED
        assert signature.is_valid is True
        assert signature.document_hash is not None
        assert signature.signature_hash is not None

    @pytest.mark.asyncio
    async def test_signature_reason_required(self, signature_service, sample_document):
        """Test that signature reason is required and meaningful"""
        # Too short reason should fail
        with pytest.raises(ValueError, match="at least 10 characters"):
            await signature_service.create_signature(
                user_id="user-001",
                username="jdoe",
                full_name="John Doe",
                resource_type="code_snippet",
                resource_id="snippet-123",
                signature_meaning=SignatureMeaning.APPROVED,
                reason="OK",  # Too short
                password="secure_password",
                document_content=sample_document
            )

    @pytest.mark.asyncio
    async def test_verify_signature_valid(self, signature_service, sample_document):
        """Test signature verification with valid document"""
        # Create signature
        signature = await signature_service.create_signature(
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            reason="Approval of code snippet for regulatory submission",
            password="secure_password",
            document_content=sample_document
        )

        # Verify with same document
        is_valid = await signature_service.verify_signature(
            signature.signature_id,
            sample_document
        )

        assert is_valid is True

    @pytest.mark.asyncio
    async def test_verify_signature_tampered_document(self, signature_service, sample_document):
        """Test signature verification detects tampered document"""
        # Create signature
        signature = await signature_service.create_signature(
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            reason="Approval of code snippet for regulatory submission",
            password="secure_password",
            document_content=sample_document
        )

        # Tamper with document
        tampered_document = sample_document.copy()
        tampered_document["code"] = "AGEGR1 <- 'Modified Code'"

        # Verification should fail
        is_valid = await signature_service.verify_signature(
            signature.signature_id,
            tampered_document
        )

        assert is_valid is False

    @pytest.mark.asyncio
    async def test_revoke_signature(self, signature_service, sample_document):
        """Test signature revocation"""
        # Create signature
        signature = await signature_service.create_signature(
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            reason="Approval of code snippet for regulatory submission",
            password="secure_password",
            document_content=sample_document
        )

        # Revoke signature
        revoked = await signature_service.revoke_signature(
            signature.signature_id,
            revoked_by="admin-user",
            revocation_reason="Code was found to have errors after approval"
        )

        assert revoked is True

        # Verify signature is no longer valid
        is_valid = await signature_service.verify_signature(
            signature.signature_id,
            sample_document
        )

        assert is_valid is False

    @pytest.mark.asyncio
    async def test_get_signatures_for_resource(self, signature_service, sample_document):
        """Test retrieving all signatures for a resource"""
        # Create multiple signatures
        await signature_service.create_signature(
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.REVIEWED,
            reason="Code review completed successfully",
            password="password1",
            document_content=sample_document
        )

        await signature_service.create_signature(
            user_id="user-002",
            username="asmith",
            full_name="Alice Smith",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            reason="Final approval for regulatory submission",
            password="password2",
            document_content=sample_document
        )

        # Get all signatures for resource
        signatures = await signature_service.get_signatures_for_resource(
            "code_snippet",
            "snippet-123"
        )

        assert len(signatures) == 2
        assert signatures[0].signature_meaning == SignatureMeaning.REVIEWED
        assert signatures[1].signature_meaning == SignatureMeaning.APPROVED


class TestSignatureManifestation:
    """Test signature manifestation (display) requirements"""

    def test_add_signature_manifestation(self):
        """Test adding signature manifestation to document"""
        from app.models.compliance import ElectronicSignature

        document = {
            "code": "some code",
            "variable": "AGEGR1"
        }

        signature = ElectronicSignature(
            signature_id="sig-001",
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            signed_at=datetime(2025, 11, 20, 14, 30, 45),
            signature_hash="abc123",
            document_hash="def456",
            reason="Approval for Study ABC-123"
        )

        # Add manifestation
        updated_doc = SignatureManifestationService.add_signature_manifestation(
            document, signature
        )

        # Verify manifestation added
        assert "signatures" in updated_doc
        assert len(updated_doc["signatures"]) == 1

        manifestation = updated_doc["signatures"][0]
        assert manifestation["signed_by"] == "/s/ John Doe"
        assert "Approved by: John Doe" in manifestation["meaning"]
        assert manifestation["reason"] == "Approval for Study ABC-123"

    def test_generate_signature_block(self):
        """Test generating text signature block"""
        from app.models.compliance import ElectronicSignature

        signature = ElectronicSignature(
            signature_id="sig-001",
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            signed_at=datetime(2025, 11, 20, 14, 30, 45),
            signature_hash="abc123",
            document_hash="def456",
            reason="Approval for Study ABC-123"
        )

        block = SignatureManifestationService.generate_signature_block(signature)

        assert "ELECTRONIC SIGNATURE" in block
        assert "/s/ John Doe" in block
        assert "Approved" in block
        assert "2025-11-20" in block
        assert "Approval for Study ABC-123" in block


class TestRegulatoryCompliance:
    """Test 21 CFR Part 11 compliance requirements"""

    @pytest.mark.asyncio
    async def test_21_cfr_part_11_50_a_requirements(self, signature_service):
        """
        Test 21 CFR Part 11.50(a) requirements:
        Signed electronic records shall contain information associated with the signing
        that clearly indicates all of the following:
        (1) The printed name of the signer
        (2) The date and time when the signature was executed
        (3) The meaning (such as review, approval, responsibility, or authorship) of the signature
        """
        document = {"code": "test"}

        signature = await signature_service.create_signature(
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            reason="Testing 21 CFR Part 11.50(a) compliance",
            password="password",
            document_content=document
        )

        # Verify requirement (1): Printed name
        assert signature.full_name == "John Doe"

        # Verify requirement (2): Date and time
        assert signature.signed_at is not None
        assert isinstance(signature.signed_at, datetime)

        # Verify requirement (3): Meaning
        assert signature.signature_meaning == SignatureMeaning.APPROVED

    @pytest.mark.asyncio
    async def test_21_cfr_part_11_50_b_requirements(self, signature_service):
        """
        Test 21 CFR Part 11.50(b) requirements:
        Signature/record linking
        """
        document = {"code": "test"}

        signature = await signature_service.create_signature(
            user_id="user-001",
            username="jdoe",
            full_name="John Doe",
            resource_type="code_snippet",
            resource_id="snippet-123",
            signature_meaning=SignatureMeaning.APPROVED,
            reason="Testing signature-record linking",
            password="password",
            document_content=document
        )

        # Verify signature is linked to record
        assert signature.resource_type == "code_snippet"
        assert signature.resource_id == "snippet-123"

        # Verify signature contains document hash
        assert signature.document_hash is not None

        # Verify document cannot be changed without detection
        tampered_doc = {"code": "modified"}
        is_valid = await signature_service.verify_signature(
            signature.signature_id,
            tampered_doc
        )
        assert is_valid is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
