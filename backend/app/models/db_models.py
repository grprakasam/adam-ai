"""
SQLAlchemy Database Models
ORM models for PostgreSQL database

Implements 21 CFR Part 11 compliant data storage:
- Immutable audit trail
- Electronic signatures
- User management
- Code snippets and metadata
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    Enum,
    JSON,
    Index,
    CheckConstraint,
    UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, BIGINT
import uuid

from app.core.database import Base
from app.models.compliance import AuditAction, SignatureMeaning


# ============================================================================
# User Management Models
# ============================================================================

class UserDB(Base):
    """
    User database model

    Stores user accounts with secure password hashing
    """
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"user-{uuid.uuid4().hex[:12]}"
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # User status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Role and permissions
    role: Mapped[str] = mapped_column(String(50), default="statistician", nullable=False)
    permissions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Password security
    password_changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    account_locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    audit_entries = relationship("AuditEntryDB", back_populates="user", cascade="all, delete-orphan")
    signatures = relationship("ElectronicSignatureDB", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_user_username", "username"),
        Index("idx_user_email", "email"),
        Index("idx_user_active", "is_active"),
    )


# ============================================================================
# Audit Trail Models (21 CFR Part 11 Compliance)
# ============================================================================

class AuditEntryDB(Base):
    """
    Immutable audit trail entry

    Implements blockchain-style hash chaining for tamper detection
    Complies with 21 CFR Part 11.10(e) - Audit trail requirements
    """
    __tablename__ = "audit_entries"

    # Primary key
    audit_id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"audit-{uuid.uuid4().hex}"
    )

    # Timestamp (required by 21 CFR Part 11.10(e)(1))
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # User information (required by 21 CFR Part 11.10(e)(2))
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)

    # Action performed (required by 21 CFR Part 11.10(e)(3))
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Resource affected
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # State tracking (before/after)
    before_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    after_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Regulatory compliance
    regulatory_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cfr_part_11_compliant: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Blockchain-style hash chain (tamper detection)
    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    current_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    # System metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    user = relationship("UserDB", back_populates="audit_entries")

    __table_args__ = (
        Index("idx_audit_timestamp", "timestamp"),
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_action", "action"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_hash", "current_hash"),
        # Immutability: Prevent updates and deletes at database level
        CheckConstraint("current_hash IS NOT NULL", name="audit_hash_required"),
    )


# ============================================================================
# Electronic Signature Models (21 CFR Part 11.50)
# ============================================================================

class ElectronicSignatureDB(Base):
    """
    Electronic signature record

    Complies with 21 CFR Part 11.50:
    - (a)(1): Printed name of signer
    - (a)(2): Date and time of signature
    - (a)(3): Meaning of signature
    """
    __tablename__ = "electronic_signatures"

    # Primary key
    signature_id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"sig-{uuid.uuid4().hex}"
    )

    # User information (21 CFR Part 11.50(a)(1))
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Timestamp (21 CFR Part 11.50(a)(2))
    signed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Signature meaning (21 CFR Part 11.50(a)(3))
    signature_meaning: Mapped[str] = mapped_column(String(50), nullable=False)

    # Reason for signature (required)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    # Resource being signed
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    resource_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Cryptographic integrity
    signature_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    document_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Signature validity
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    revocation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # System metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user = relationship("UserDB", back_populates="signatures")

    __table_args__ = (
        Index("idx_signature_user", "user_id"),
        Index("idx_signature_resource", "resource_type", "resource_id"),
        Index("idx_signature_timestamp", "signed_at"),
        Index("idx_signature_meaning", "signature_meaning"),
        CheckConstraint("LENGTH(reason) >= 10", name="signature_reason_min_length"),
    )


# ============================================================================
# Code Generation Models
# ============================================================================

class CodeSnippetDB(Base):
    """
    Generated code snippet with metadata and validation results
    """
    __tablename__ = "code_snippets"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"snippet-{uuid.uuid4().hex[:12]}"
    )

    # Code content
    code: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(20), nullable=False, default="R")

    # Associated variable
    variable_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    variable_label: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    variable_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Associated dataset
    dataset_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Generation metadata
    llm_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Validation results
    validation_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    validation_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    cdisc_compliant: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # CDISC rule validation
    rules_passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rules_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    warnings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="generated", nullable=False)
    approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approved_by: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Audit fields
    created_by: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    creator = relationship("UserDB")

    __table_args__ = (
        Index("idx_snippet_variable", "variable_name"),
        Index("idx_snippet_dataset", "dataset_name"),
        Index("idx_snippet_status", "status"),
        Index("idx_snippet_approved", "approved"),
        Index("idx_snippet_created", "created_at"),
    )


class DatasetDB(Base):
    """
    ADAM dataset metadata
    """
    __tablename__ = "datasets"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"dataset-{uuid.uuid4().hex[:12]}"
    )

    # Dataset identification
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # CDISC metadata
    dataset_class: Mapped[str] = mapped_column(String(50), default="ADAM", nullable=False)
    structure: Mapped[str] = mapped_column(Text, nullable=False)
    purpose: Mapped[str] = mapped_column(String(100), default="Analysis", nullable=False)

    # Study association
    study_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    protocol: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="in_progress", nullable=False)
    finalized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Audit fields
    created_by: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    creator = relationship("UserDB")
    variables = relationship("VariableDB", back_populates="dataset", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_dataset_name", "name"),
        Index("idx_dataset_study", "study_id"),
        Index("idx_dataset_status", "status"),
    )


class VariableDB(Base):
    """
    ADAM variable metadata
    """
    __tablename__ = "variables"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"var-{uuid.uuid4().hex[:12]}"
    )

    # Variable identification
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Dataset association
    dataset_id: Mapped[str] = mapped_column(String(50), ForeignKey("datasets.id"), nullable=False, index=True)

    # Variable properties
    variable_type: Mapped[str] = mapped_column(String(50), nullable=False)
    length: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    format: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # CDISC metadata
    origin: Mapped[str] = mapped_column(String(50), default="Derived", nullable=False)
    source: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    codelist: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Computational method
    method: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    method_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    dataset = relationship("DatasetDB", back_populates="variables")

    __table_args__ = (
        Index("idx_variable_name", "name"),
        Index("idx_variable_dataset", "dataset_id"),
        UniqueConstraint("dataset_id", "name", name="uq_dataset_variable"),
    )


# ============================================================================
# Define-XML Models
# ============================================================================

class DefineXMLDB(Base):
    """
    Generated Define-XML metadata documents
    """
    __tablename__ = "define_xml"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"define-{uuid.uuid4().hex[:12]}"
    )

    # Study information
    study_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    study_name: Mapped[str] = mapped_column(String(255), nullable=False)
    protocol: Mapped[str] = mapped_column(String(100), nullable=False)
    sponsor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # ADAM IG version
    adam_ig_version: Mapped[str] = mapped_column(String(20), default="2.1", nullable=False)

    # XML content
    xml_content: Mapped[str] = mapped_column(Text, nullable=False)

    # Validation
    validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    validation_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Audit fields
    generated_by: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    generator = relationship("UserDB")

    __table_args__ = (
        Index("idx_define_study", "study_id"),
        Index("idx_define_generated", "generated_at"),
    )


# ============================================================================
# Code Review & Finalization Models
# ============================================================================

class CodeReviewSessionDB(Base):
    """
    Code review session for consolidated ADAM program

    Tracks the review workflow for complete programs (not individual variables).
    Each session is scoped to study_id + dataset + language + run_id.
    """
    __tablename__ = "code_review_sessions"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"review-session-{uuid.uuid4().hex[:12]}"
    )

    # Study context (composite key for uniqueness)
    study_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    dataset: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    run_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Review status
    status: Mapped[str] = mapped_column(
        String(50),
        default="not_started",
        nullable=False,
        index=True
    )  # not_started, in_review, changes_requested, approved

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    comments = relationship(
        "CodeReviewCommentDB",
        back_populates="session",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "study_id", "dataset", "language", "run_id",
            name="uq_review_session_context"
        ),
        Index("idx_review_session_study", "study_id"),
        Index("idx_review_session_status", "status"),
        Index("idx_review_session_created", "created_at"),
    )


class CodeReviewCommentDB(Base):
    """
    Comment on a code review session

    Supports line-level commenting on consolidated programs.
    Each comment belongs to a session and optionally references a line number.
    """
    __tablename__ = "code_review_comments"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"review-comment-{uuid.uuid4().hex[:12]}"
    )

    # Foreign key to session
    session_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("code_review_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Comment location
    line_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    variable_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Comment content
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Author information
    author: Mapped[str] = mapped_column(String(255), default="System", nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="reviewer", nullable=False)

    # Comment status
    status: Mapped[str] = mapped_column(
        String(20),
        default="open",
        nullable=False
    )  # open, resolved, dismissed

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        onupdate=datetime.utcnow,
        nullable=True
    )

    # Relationships
    session = relationship("CodeReviewSessionDB", back_populates="comments")

    __table_args__ = (
        Index("idx_review_comment_session", "session_id"),
        Index("idx_review_comment_line", "line_number"),
        Index("idx_review_comment_status", "status"),
        Index("idx_review_comment_created", "created_at"),
    )


# ============================================================================
# Study Management Models
# ============================================================================

class StudyDB(Base):
    """
    Study database model
    Stores clinical study metadata
    """
    __tablename__ = "studies"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    protocol_number: Mapped[Optional[str]] = mapped_column(String(255))
    sponsor: Mapped[Optional[str]] = mapped_column(String(255))
    therapeutic_area: Mapped[Optional[str]] = mapped_column(String(255))
    phase: Mapped[Optional[str]] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Progress tracking
    setup_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    code_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    validation_status: Mapped[str] = mapped_column(String(50), default='not_started')
    submission_status: Mapped[str] = mapped_column(String(50), default='not_ready')

    # Standards versions
    sdtm_version: Mapped[Optional[str]] = mapped_column(String(50))
    adam_ig_version: Mapped[Optional[str]] = mapped_column(String(50))
    meddra_version: Mapped[Optional[str]] = mapped_column(String(50))

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_studies_created_by", "created_by"),
        Index("idx_studies_created_at", "created_at"),
        Index("idx_studies_is_deleted", "is_deleted"),
    )


# ============================================================================
# Study Documents & Chatbot Models
# ============================================================================

class StudyDatasetSelectionDB(Base):
    """
    Enhanced dataset selection for studies
    Tracks which ADAM datasets are selected for generation
    """
    __tablename__ = "study_dataset_selections"

    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"dataset-sel-{uuid.uuid4().hex[:12]}"
    )
    study_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("studies.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    dataset_name: Mapped[str] = mapped_column(String(50), nullable=False)  # ADSL, ADAE, ADLB, etc.
    language: Mapped[str] = mapped_column(String(10), nullable=False)  # R, SAS, Both
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint("study_id", "dataset_name", name="uq_study_dataset"),
        Index("idx_study_dataset_study_id", "study_id"),
        Index("idx_study_dataset_active", "study_id", "is_active"),
    )


class StudyDocumentDB(Base):
    """
    Study document storage and metadata
    Supports various document types: specifications, SAPs, ADAM specs, etc.
    """
    __tablename__ = "study_documents"

    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"doc-{uuid.uuid4().hex[:12]}"
    )
    study_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("studies.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)  # SPECIFICATION, SAP, ADAM_SPEC, etc.
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_url: Mapped[Optional[str]] = mapped_column(String(500))  # Pre-signed URL for S3
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    size_bytes: Mapped[Optional[int]] = mapped_column(BIGINT)
    version_label: Mapped[Optional[str]] = mapped_column(String(50))
    tags: Mapped[Optional[dict]] = mapped_column(JSON)  # {"visit": "week12", "dataset": "ADSL"}
    uploaded_by: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.id"),
        nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    processing_status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False
    )  # pending, processing, completed, failed
    extracted_text: Mapped[Optional[str]] = mapped_column(Text)  # For chatbot retrieval
    doc_metadata: Mapped[Optional[dict]] = mapped_column(JSON)  # Page count, sections, etc.

    # Relationships
    embeddings = relationship("DocumentEmbeddingDB", back_populates="document", cascade="all, delete-orphan")
    uploader = relationship("UserDB")

    __table_args__ = (
        Index("idx_study_doc_study_id", "study_id"),
        Index("idx_study_doc_type", "study_id", "document_type", "is_active"),
        Index("idx_study_doc_active", "study_id", "is_active"),
        Index("idx_study_doc_processing", "processing_status"),
    )


class DocumentEmbeddingDB(Base):
    """
    Vector embeddings for document chunks
    Used for RAG (Retrieval-Augmented Generation) in chatbot
    """
    __tablename__ = "document_embeddings"

    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"embed-{uuid.uuid4().hex[:12]}"
    )
    study_document_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("study_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    chunk_id: Mapped[str] = mapped_column(String(50), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_vector: Mapped[Optional[list]] = mapped_column(JSON)  # Store as JSON array
    chunk_metadata: Mapped[Optional[dict]] = mapped_column(JSON)  # page_number, section, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    document = relationship("StudyDocumentDB", back_populates="embeddings")

    __table_args__ = (
        Index("idx_embedding_doc", "study_document_id", "chunk_index"),
        Index("idx_embedding_chunk", "chunk_id"),
    )


class StudyChatSessionDB(Base):
    """
    Chatbot session for study-specific questions
    Each session belongs to a study and tracks conversation history
    """
    __tablename__ = "study_chat_sessions"

    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"chat-session-{uuid.uuid4().hex[:12]}"
    )
    study_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("studies.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title: Mapped[Optional[str]] = mapped_column(String(255))
    created_by: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.id"),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    messages = relationship("StudyChatMessageDB", back_populates="session", cascade="all, delete-orphan")
    creator = relationship("UserDB")

    __table_args__ = (
        Index("idx_chat_session_study", "study_id", "created_at"),
    )


class StudyChatMessageDB(Base):
    """
    Chat message in a chatbot session
    Stores user questions and assistant answers with citations
    """
    __tablename__ = "study_chat_messages"

    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: f"chat-msg-{uuid.uuid4().hex[:12]}"
    )
    session_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("study_chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user, assistant, system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    source_document_ids: Mapped[Optional[list]] = mapped_column(JSON)  # List of document IDs used for answer
    model_used: Mapped[Optional[str]] = mapped_column(String(100))  # gemini-2.5-flash, etc.
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer)

    # Relationships
    session = relationship("StudyChatSessionDB", back_populates="messages")

    __table_args__ = (
        Index("idx_chat_msg_session", "session_id", "timestamp"),
    )
