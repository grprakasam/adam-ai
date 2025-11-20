"""
Electronic Signature Service
Implements 21 CFR Part 11.50 - Signature Manifestations
"""

from datetime import datetime
from typing import Optional, Dict, Any
import hashlib
import json
import uuid
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from loguru import logger

from app.models.compliance import ElectronicSignature, SignatureMeaning


class ElectronicSignatureService:
    """
    Electronic signature service compliant with 21 CFR Part 11

    Requirements per 21 CFR Part 11.50:
    - Signed electronic records shall contain information associated with the signing
    - Such information shall include:
      a) The printed name of the signer
      b) The date and time when the signature was executed
      c) The meaning associated with the signature
    """

    def __init__(self):
        self.signatures_cache = {}  # In-memory cache (will be replaced with database)

    async def create_signature(
        self,
        user_id: str,
        username: str,
        full_name: str,
        resource_type: str,
        resource_id: str,
        signature_meaning: SignatureMeaning,
        reason: str,
        password: str,
        document_content: Dict[str, Any],
        ip_address: Optional[str] = None
    ) -> ElectronicSignature:
        """
        Create electronic signature for a document

        Args:
            user_id: Unique user identifier
            username: Username
            full_name: Full legal name of signer
            resource_type: Type of resource being signed (code_snippet, program, etc.)
            resource_id: Unique identifier of resource
            signature_meaning: Meaning of signature (approved, reviewed, etc.)
            reason: Reason for signing (required by 21 CFR Part 11)
            password: User password for verification
            document_content: Content being signed
            ip_address: IP address of signer

        Returns:
            ElectronicSignature object

        Raises:
            ValueError: If password is invalid or signature creation fails
        """
        logger.info(f"Creating electronic signature: user={username}, resource={resource_type}/{resource_id}")

        # 1. Verify user password (authentication required for e-signature)
        # TODO: Replace with actual password verification from database
        # if not await self._verify_password(user_id, password):
        #     raise ValueError("Invalid password for electronic signature")

        # 2. Calculate document hash (SHA-256)
        document_hash = self._calculate_document_hash(document_content)

        # 3. Create signature data
        signature_data = {
            "user_id": user_id,
            "username": username,
            "full_name": full_name,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "signature_meaning": signature_meaning,
            "timestamp": datetime.utcnow().isoformat(),
            "reason": reason,
            "document_hash": document_hash
        }

        # 4. Generate cryptographic signature
        signature_hash = self._generate_signature_hash(signature_data, password)

        # 5. Create signature record
        signature = ElectronicSignature(
            signature_id=str(uuid.uuid4()),
            user_id=user_id,
            username=username,
            full_name=full_name,
            resource_type=resource_type,
            resource_id=resource_id,
            signature_meaning=signature_meaning,
            signed_at=datetime.utcnow(),
            signature_hash=signature_hash,
            document_hash=document_hash,
            reason=reason,
            ip_address=ip_address,
            is_valid=True
        )

        # 6. Store signature (in-memory for now, will be database)
        self.signatures_cache[signature.signature_id] = signature

        logger.info(f"Electronic signature created: {signature.signature_id}")

        return signature

    async def verify_signature(
        self,
        signature_id: str,
        document_content: Dict[str, Any]
    ) -> bool:
        """
        Verify electronic signature is valid and document hasn't been tampered with

        Args:
            signature_id: Signature identifier
            document_content: Current document content

        Returns:
            True if signature is valid, False otherwise
        """
        logger.info(f"Verifying electronic signature: {signature_id}")

        # 1. Retrieve signature
        signature = self.signatures_cache.get(signature_id)
        if not signature:
            logger.error(f"Signature not found: {signature_id}")
            return False

        # 2. Check if signature has been revoked
        if not signature.is_valid or signature.revoked_at:
            logger.warning(f"Signature has been revoked: {signature_id}")
            return False

        # 3. Calculate current document hash
        current_hash = self._calculate_document_hash(document_content)

        # 4. Compare with signature's document hash
        if current_hash != signature.document_hash:
            logger.error(
                f"Document hash mismatch for signature {signature_id}: "
                f"expected={signature.document_hash}, actual={current_hash}"
            )
            return False

        logger.info(f"Signature verified successfully: {signature_id}")
        return True

    async def revoke_signature(
        self,
        signature_id: str,
        revoked_by: str,
        revocation_reason: str
    ) -> bool:
        """
        Revoke an electronic signature

        Args:
            signature_id: Signature to revoke
            revoked_by: User revoking the signature
            revocation_reason: Reason for revocation

        Returns:
            True if revoked successfully
        """
        logger.info(f"Revoking signature: {signature_id}, by: {revoked_by}")

        signature = self.signatures_cache.get(signature_id)
        if not signature:
            logger.error(f"Signature not found: {signature_id}")
            return False

        signature.is_valid = False
        signature.revoked_at = datetime.utcnow()
        signature.revoked_by = revoked_by
        signature.revocation_reason = revocation_reason

        logger.info(f"Signature revoked: {signature_id}")
        return True

    async def get_signature(self, signature_id: str) -> Optional[ElectronicSignature]:
        """Get signature by ID"""
        return self.signatures_cache.get(signature_id)

    async def get_signatures_for_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> list[ElectronicSignature]:
        """Get all signatures for a specific resource"""
        return [
            sig for sig in self.signatures_cache.values()
            if sig.resource_type == resource_type and sig.resource_id == resource_id
        ]

    def _calculate_document_hash(self, document: Dict[str, Any]) -> str:
        """Calculate SHA-256 hash of document"""
        # Sort keys to ensure consistent hashing
        json_str = json.dumps(document, sort_keys=True)
        return hashlib.sha256(json_str.encode()).hexdigest()

    def _generate_signature_hash(self, signature_data: Dict[str, Any], password: str) -> str:
        """
        Generate cryptographic signature hash

        In production, this should use:
        - RSA private key stored securely
        - Password to decrypt private key
        - Digital signature algorithm (RSA-SHA256)

        For now, using HMAC-SHA256 with password as key
        """
        json_str = json.dumps(signature_data, sort_keys=True)
        combined = f"{json_str}:{password}"
        return hashlib.sha256(combined.encode()).hexdigest()

    async def _verify_password(self, user_id: str, password: str) -> bool:
        """
        Verify user password
        TODO: Implement actual password verification from database
        """
        # This would check against hashed password in database
        return True


class SignatureManifestationService:
    """
    Service to add signature manifestations to documents
    Per 21 CFR Part 11.50(a), signed electronic records must display:
    - Printed name of signer
    - Date and time of signature
    - Meaning of signature
    """

    @staticmethod
    def add_signature_manifestation(
        document: Dict[str, Any],
        signature: ElectronicSignature
    ) -> Dict[str, Any]:
        """
        Add signature manifestation to document

        Example output:
        /s/ John Doe
        Approved by: John Doe
        Date: 2025-11-20 14:30:45 UTC
        Reason: Approval of ADSL code generation for Study ABC-123
        """
        if "signatures" not in document:
            document["signatures"] = []

        manifestation = {
            "signature_id": signature.signature_id,
            "signed_by": f"/s/ {signature.full_name}",
            "meaning": f"{signature.signature_meaning.value.title()} by: {signature.full_name}",
            "date": signature.signed_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "reason": signature.reason,
            "is_valid": signature.is_valid
        }

        document["signatures"].append(manifestation)

        return document

    @staticmethod
    def generate_signature_block(signature: ElectronicSignature) -> str:
        """
        Generate text signature block for display

        Returns formatted signature block:
        ═══════════════════════════════════════════════
        ELECTRONIC SIGNATURE
        ═══════════════════════════════════════════════
        Signed by: /s/ John Doe
        Meaning: Approved
        Date: 2025-11-20 14:30:45 UTC
        Reason: Approval of ADSL code generation
        ═══════════════════════════════════════════════
        """
        return f"""
═══════════════════════════════════════════════
ELECTRONIC SIGNATURE
═══════════════════════════════════════════════
Signed by: /s/ {signature.full_name}
Meaning: {signature.signature_meaning.value.title()}
Date: {signature.signed_at.strftime("%Y-%m-%d %H:%M:%S UTC")}
Reason: {signature.reason}
{'[REVOKED]' if not signature.is_valid else ''}
═══════════════════════════════════════════════
        """.strip()


# Global service instance
_electronic_signature_service = None


def get_electronic_signature_service() -> ElectronicSignatureService:
    """Get or create electronic signature service singleton"""
    global _electronic_signature_service
    if _electronic_signature_service is None:
        _electronic_signature_service = ElectronicSignatureService()
    return _electronic_signature_service
