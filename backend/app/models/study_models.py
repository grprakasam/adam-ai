"""
Study-related Pydantic models for multi-study architecture
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class PermissionLevel(str, Enum):
    VIEWER = "viewer"
    EDITOR = "editor"
    ADMIN = "admin"


class ValidationStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"


class SubmissionStatus(str, Enum):
    NOT_READY = "not_ready"
    READY = "ready"
    SUBMITTED = "submitted"
    APPROVED = "approved"


class DatasetStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


# Study Models
class StudyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Study name")
    protocol_number: Optional[str] = Field(None, max_length=255)
    sponsor: Optional[str] = Field(None, max_length=255)
    therapeutic_area: Optional[str] = Field(None, max_length=255)
    phase: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    sdtm_version: Optional[str] = Field(None, max_length=50)
    adam_ig_version: Optional[str] = Field(None, max_length=50)
    meddra_version: Optional[str] = Field(None, max_length=50)


class StudyCreate(StudyBase):
    """Request model for creating a study"""
    pass


class StudyUpdate(BaseModel):
    """Request model for updating a study"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    protocol_number: Optional[str] = None
    sponsor: Optional[str] = None
    therapeutic_area: Optional[str] = None
    phase: Optional[str] = None
    description: Optional[str] = None
    sdtm_version: Optional[str] = None
    adam_ig_version: Optional[str] = None
    meddra_version: Optional[str] = None
    setup_complete: Optional[bool] = None
    code_generated: Optional[bool] = None
    validation_status: Optional[ValidationStatus] = None
    submission_status: Optional[SubmissionStatus] = None


class StudyDataset(BaseModel):
    """Dataset within a study"""
    id: int
    dataset_name: str
    dataset_type: str = "ADAM"
    specification_path: Optional[str] = None
    generated_code_path: Optional[str] = None
    status: DatasetStatus
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class StudySpecification(BaseModel):
    """Specification file for a study dataset"""
    id: int
    filename: str
    file_path: str
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime
    is_default: bool = False
    variables_count: Optional[int] = None
    categorization_complete: bool = False

    class Config:
        from_attributes = True


class StudyAccess(BaseModel):
    """Access control for study collaboration"""
    id: int
    user_id: str
    user_email: Optional[str] = None
    permission: PermissionLevel
    granted_by: str
    granted_at: datetime
    is_active: bool = True

    class Config:
        from_attributes = True


class Study(StudyBase):
    """Complete study model (response)"""
    id: str
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None
    setup_complete: bool = False
    code_generated: bool = False
    validation_status: ValidationStatus = ValidationStatus.NOT_STARTED
    submission_status: SubmissionStatus = SubmissionStatus.NOT_READY
    is_deleted: bool = False

    # Relations (optional, loaded separately)
    datasets: Optional[List[StudyDataset]] = None
    specifications: Optional[List[StudySpecification]] = None
    access_list: Optional[List[StudyAccess]] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class StudyListItem(BaseModel):
    """Lightweight study model for list views"""
    id: str
    name: str
    protocol_number: Optional[str] = None
    sponsor: Optional[str] = None
    phase: Optional[str] = None
    created_by: str
    created_at: datetime
    last_accessed_at: Optional[datetime] = None
    setup_complete: bool
    code_generated: bool
    validation_status: ValidationStatus
    submission_status: SubmissionStatus
    datasets_count: int = 0
    my_permission: Optional[PermissionLevel] = None  # Current user's permission

    class Config:
        from_attributes = True


class StudyShareRequest(BaseModel):
    """Request to share a study with other users"""
    user_ids: List[str] = Field(..., min_items=1, description="List of user IDs to share with")
    permission: PermissionLevel = Field(PermissionLevel.VIEWER, description="Permission level")
    notify_users: bool = Field(True, description="Send notification to users")


class StudyShareResponse(BaseModel):
    """Response after sharing a study"""
    study_id: str
    shared_with: List[str]
    permission: PermissionLevel
    success: bool
    message: str


# Notification Models
class NotificationType(str, Enum):
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    INFO = "info"
    TASK = "task"


class NotificationBase(BaseModel):
    type: NotificationType
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    link: Optional[str] = Field(None, max_length=500)


class NotificationCreate(NotificationBase):
    user_id: str
    study_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class Notification(NotificationBase):
    id: int
    user_id: str
    study_id: Optional[str] = None
    read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


# Audit Log Models
class AuditAction(str, Enum):
    # Authentication
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"

    # Study operations
    STUDY_CREATED = "STUDY_CREATED"
    STUDY_UPDATED = "STUDY_UPDATED"
    STUDY_DELETED = "STUDY_DELETED"
    STUDY_SHARED = "STUDY_SHARED"
    STUDY_ACCESSED = "STUDY_ACCESSED"

    # Specification operations
    SPEC_UPLOADED = "SPEC_UPLOADED"
    SPEC_DELETED = "SPEC_DELETED"

    # Code generation
    CODE_GENERATION_STARTED = "CODE_GENERATION_STARTED"
    CODE_GENERATION_COMPLETED = "CODE_GENERATION_COMPLETED"
    CODE_GENERATION_FAILED = "CODE_GENERATION_FAILED"

    # Validation
    VALIDATION_RUN = "VALIDATION_RUN"
    P21_VALIDATION_RUN = "P21_VALIDATION_RUN"

    # Submission
    DEFINE_XML_GENERATED = "DEFINE_XML_GENERATED"
    ADRG_GENERATED = "ADRG_GENERATED"
    SDRG_GENERATED = "SDRG_GENERATED"
    ECTD_PACKAGE_CREATED = "ECTD_PACKAGE_CREATED"
    SUBMISSION_CREATED = "SUBMISSION_CREATED"

    # Admin operations
    USER_ROLE_CHANGED = "USER_ROLE_CHANGED"
    TEMPLATE_CREATED = "TEMPLATE_CREATED"
    TEMPLATE_UPDATED = "TEMPLATE_UPDATED"
    TEMPLATE_DELETED = "TEMPLATE_DELETED"


class AuditLogEntry(BaseModel):
    """Audit log entry (21 CFR Part 11 compliant)"""
    id: int
    timestamp: datetime
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    study_id: Optional[str] = None
    action: AuditAction
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogFilter(BaseModel):
    """Filters for audit log queries"""
    user_id: Optional[str] = None
    study_id: Optional[str] = None
    action: Optional[AuditAction] = None
    resource_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    skip: int = Field(0, ge=0)
    limit: int = Field(100, ge=1, le=1000)


# Template Models
class TemplateCategory(str, Enum):
    PROMPT = "PROMPT"
    VALIDATION = "VALIDATION"
    SUBMISSION = "SUBMISSION"


class TemplateBase(BaseModel):
    name: str = Field(..., max_length=255)
    category: TemplateCategory
    subcategory: Optional[str] = Field(None, max_length=100)
    version: str = Field("1.0", max_length=50)
    study_scoped: bool = False
    description: Optional[str] = None


class TemplateCreate(TemplateBase):
    content: Optional[str] = None
    file_path: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    file_path: Optional[str] = None
    is_active: Optional[bool] = None


class Template(TemplateBase):
    id: int
    content: Optional[str] = None
    file_path: Optional[str] = None
    is_active: bool = True
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


# Search Models
class SearchType(str, Enum):
    VARIABLE = "variable"
    CODE = "code"
    STUDY = "study"
    DATASET = "dataset"
    HELP = "help"
    ARTIFACT = "artifact"


class SearchResult(BaseModel):
    type: SearchType
    title: str
    description: Optional[str] = None
    study_id: Optional[str] = None
    url: str
    metadata: Optional[Dict[str, Any]] = None
    relevance_score: Optional[float] = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
    took_ms: int  # Search duration in milliseconds


# API Response Models
class APIResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None
    errors: Optional[List[str]] = None


class PaginatedResponse(BaseModel):
    """Paginated response"""
    items: List[Any]
    total: int
    skip: int
    limit: int
    has_more: bool


# ============================================================================
# Study Documents & Chat Models
# ============================================================================

class DocumentType(str, Enum):
    SPECIFICATION = "SPECIFICATION"
    SAP = "SAP"
    ADAM_SPEC = "ADAM_SPEC"
    SDTM_SPEC = "SDTM_SPEC"
    CT_LIST = "CT_LIST"
    PROTOCOL = "PROTOCOL"
    OTHER = "OTHER"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class StudyDatasetSelectionRequest(BaseModel):
    """Request to update dataset selections"""
    datasets: List[Dict[str, Any]] = Field(..., description="List of dataset selections")
    # Each item: {"dataset_name": "ADSL", "language": "R", "priority": 0}


class StudyDatasetSelection(BaseModel):
    """Dataset selection for a study"""
    id: str
    study_id: str
    dataset_name: str
    language: str
    is_active: bool
    priority: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudyDocumentBase(BaseModel):
    """Base document model"""
    document_type: DocumentType
    version_label: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    description: Optional[str] = None


class StudyDocumentCreate(StudyDocumentBase):
    """Request to upload a document"""
    pass


class StudyDocument(StudyDocumentBase):
    """Complete document model"""
    id: str
    study_id: str
    file_name: str
    original_file_name: str
    storage_path: str
    storage_url: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    uploaded_by: str
    uploaded_at: datetime
    is_active: bool
    processing_status: ProcessingStatus
    extracted_text: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    """Request for chatbot"""
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    temperature: Optional[float] = Field(0.1, ge=0.0, le=1.0)


class Citation(BaseModel):
    """Citation for chatbot answer"""
    document_id: str
    document_name: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    chunk_text: Optional[str] = None


class ChatMessage(BaseModel):
    """Chat message"""
    id: str
    role: str  # user, assistant, system
    content: str
    timestamp: datetime
    source_document_ids: Optional[List[str]] = None
    citations: Optional[List[Citation]] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    """Response from chatbot"""
    answer: str
    citations: List[Citation]
    source_document_ids: List[str]
    session_id: str
    message_id: str


class ChatSession(BaseModel):
    """Chat session"""
    id: str
    study_id: str
    title: Optional[str] = None
    created_by: str
    created_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ChatSessionDetail(ChatSession):
    """Chat session with messages"""
    messages: List[ChatMessage] = []

    class Config:
        from_attributes = True