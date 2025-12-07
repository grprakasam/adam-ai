"""Study documents and chatbot tables

Revision ID: 002_study_documents_chat
Revises: 001_multi_study
Create Date: 2025-11-25 12:00:00.000000

Adds:
- study_dataset_selections table (enhanced dataset selection)
- study_documents table (document management)
- document_embeddings table (vector embeddings for RAG)
- study_chat_sessions table (chatbot sessions)
- study_chat_messages table (chat messages with citations)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, BIGINT
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '002_study_documents_chat'
down_revision = '001_multi_study'
branch_labels = None
depends_on = None


def upgrade():
    # Study Dataset Selections (enhanced from existing study_datasets)
    op.create_table(
        'study_dataset_selections',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('dataset_name', sa.String(50), nullable=False),  # ADSL, ADAE, ADLB, etc.
        sa.Column('language', sa.String(10), nullable=False),  # R, SAS, Both
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('priority', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_study_dataset_study_id', 'study_dataset_selections', ['study_id'])
    op.create_index('idx_study_dataset_active', 'study_dataset_selections', ['study_id', 'is_active'])
    op.create_unique_constraint('uq_study_dataset', 'study_dataset_selections', ['study_id', 'dataset_name'])

    # Study Documents
    op.create_table(
        'study_documents',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=False),  # SPECIFICATION, SAP, ADAM_SPEC, etc.
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('original_file_name', sa.String(255), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('storage_url', sa.String(500)),  # Pre-signed URL for S3
        sa.Column('mime_type', sa.String(100)),
        sa.Column('size_bytes', BIGINT),
        sa.Column('version_label', sa.String(50)),
        sa.Column('tags', JSONB),  # {"visit": "week12", "dataset": "ADSL"}
        sa.Column('uploaded_by', sa.String(255), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('uploaded_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('processing_status', sa.String(50), default='pending'),  # pending, processing, completed, failed
        sa.Column('extracted_text', sa.Text),  # For chatbot retrieval
        sa.Column('metadata', JSONB),  # Page count, sections, etc.
    )
    op.create_index('idx_study_doc_study_id', 'study_documents', ['study_id'])
    op.create_index('idx_study_doc_type', 'study_documents', ['study_id', 'document_type', 'is_active'])
    op.create_index('idx_study_doc_active', 'study_documents', ['study_id', 'is_active'])
    op.create_index('idx_study_doc_processing', 'study_documents', ['processing_status'])

    # Document Embeddings (for vector search/RAG)
    op.create_table(
        'document_embeddings',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('study_document_id', sa.String(50), sa.ForeignKey('study_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_id', sa.String(50), nullable=False),
        sa.Column('chunk_index', sa.Integer, nullable=False),
        sa.Column('chunk_text', sa.Text, nullable=False),
        sa.Column('embedding_vector', JSONB),  # Store as JSON array, or use pgvector if available
        sa.Column('metadata', JSONB),  # page_number, section, etc.
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow, nullable=False),
    )
    op.create_index('idx_embedding_doc', 'document_embeddings', ['study_document_id', 'chunk_index'])
    op.create_index('idx_embedding_chunk', 'document_embeddings', ['chunk_id'])

    # Study Chat Sessions
    op.create_table(
        'study_chat_sessions',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255)),
        sa.Column('created_by', sa.String(255), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow, nullable=False),
    )
    op.create_index('idx_chat_session_study', 'study_chat_sessions', ['study_id', 'created_at'])

    # Study Chat Messages
    op.create_table(
        'study_chat_messages',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('session_id', sa.String(50), sa.ForeignKey('study_chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),  # user, assistant, system
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('timestamp', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('source_document_ids', JSONB),  # List of document IDs used for answer
        sa.Column('model_used', sa.String(100)),  # gemini-2.5-flash, etc.
        sa.Column('tokens_used', sa.Integer),
    )
    op.create_index('idx_chat_msg_session', 'study_chat_messages', ['session_id', 'timestamp'])


def downgrade():
    op.drop_table('study_chat_messages')
    op.drop_table('study_chat_sessions')
    op.drop_table('document_embeddings')
    op.drop_table('study_documents')
    op.drop_table('study_dataset_selections')





