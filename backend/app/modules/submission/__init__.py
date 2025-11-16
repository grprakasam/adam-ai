"""
Submission Readiness Module

Provides FDA submission validation and package generation capabilities:
- Pre-flight structural validation
- Controlled Terminology validation
- P21 Community Edition integration
- Define.xml 2.1 generation
- ADRG/SDRG document generation
- eCTD packaging
- Comprehensive audit trail
"""

from .service import SubmissionOrchestrationService
from .models import (
    SubmissionReadinessScore,
    ValidationSummary,
    PackageManifest,
    Artifact,
)

__all__ = [
    "SubmissionOrchestrationService",
    "SubmissionReadinessScore",
    "ValidationSummary",
    "PackageManifest",
    "Artifact",
]
