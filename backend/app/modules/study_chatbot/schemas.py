"""
Study Chatbot Schemas

Pydantic models for study chatbot requests and responses.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class FileInfo(BaseModel):
    """Information about an uploaded file"""
    filename: str
    file_type: str
    file_size: int
    upload_time: datetime


class KnowledgeInsight(BaseModel):
    """A single insight extracted from the knowledge base"""
    insight: str
    source: str
    confidence: float = Field(ge=0, le=1)


class KnowledgeBaseRequest(BaseModel):
    """Request to create/update knowledge base"""
    session_id: str = Field(..., description="Unique session identifier")
    file_paths: List[str] = Field(..., description="List of uploaded file paths")


class KnowledgeBaseResponse(BaseModel):
    """Response after knowledge base creation"""
    session_id: str
    study_id: Optional[str] = None
    phase: Optional[str] = None
    subject_count: Optional[int] = None
    primary_endpoint: Optional[str] = None
    insights: List[str] = Field(default_factory=list)
    files_processed: int
    processing_time_ms: int
    status: Literal["success", "partial", "failed"]
    error_message: Optional[str] = None


class SuggestedQuestion(BaseModel):
    """A suggested question for the user"""
    id: str
    question: str
    category: str
    priority: int = Field(ge=1, le=5, description="1=highest, 5=lowest")


class SuggestedQuestionsResponse(BaseModel):
    """Response containing suggested questions"""
    session_id: str
    questions: List[SuggestedQuestion]


class ChatRequest(BaseModel):
    """Request to chat with the assistant"""
    session_id: str = Field(..., description="Session identifier")
    message: str = Field(..., min_length=1, max_length=2000)
    response_style: Literal["concise", "detailed", "technical"] = Field("detailed")
    language: str = Field("en", description="Response language code")
    show_sources: bool = Field(True, description="Include source references")


class ChatMessage(BaseModel):
    """A single chat message"""
    id: str
    type: Literal["user", "assistant", "system"]
    content: str
    timestamp: datetime
    sources: Optional[List[str]] = None


class ChatResponse(BaseModel):
    """Response from chat assistant"""
    session_id: str
    message: ChatMessage
    processing_time_ms: int
    tokens_used: Optional[int] = None
