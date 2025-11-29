"""
Study Chatbot Module

RAG-based chatbot for clinical trial study assistance.
Helps users understand study design, endpoints, and requirements through conversational AI.
"""

from .service import StudyChatbotService
from .schemas import (
    KnowledgeBaseRequest,
    KnowledgeBaseResponse,
    ChatRequest,
    ChatResponse,
    SuggestedQuestionsResponse,
)

__all__ = [
    'StudyChatbotService',
    'KnowledgeBaseRequest',
    'KnowledgeBaseResponse',
    'ChatRequest',
    'ChatResponse',
    'SuggestedQuestionsResponse',
]
