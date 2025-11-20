"""Multi-study architecture with compliance

Revision ID: 001_multi_study
Revises:
Create Date: 2025-11-20 10:00:00.000000

Adds:
- studies table
- study_access table (collaboration)
- notifications table
- audit_logs table (21 CFR Part 11 compliant)
- templates table
- user_sessions table
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '001_multi_study'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Studies Table
    op.create_table(
        'studies',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('protocol_number', sa.String(255)),
        sa.Column('sponsor', sa.String(255)),
        sa.Column('therapeutic_area', sa.String(255)),
        sa.Column('phase', sa.String(50)),
        sa.Column('description', sa.Text),
        sa.Column('created_by', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
        sa.Column('last_accessed_at', sa.DateTime),

        # Progress tracking
        sa.Column('setup_complete', sa.Boolean, default=False),
        sa.Column('code_generated', sa.Boolean, default=False),
        sa.Column('validation_status', sa.String(50), default='not_started'),
        sa.Column('submission_status', sa.String(50), default='not_ready'),

        # Standards versions
        sa.Column('sdtm_version', sa.String(50)),
        sa.Column('adam_ig_version', sa.String(50)),
        sa.Column('meddra_version', sa.String(50)),

        # Metadata (JSON)
        sa.Column('metadata', JSONB),

        # Soft delete
        sa.Column('is_deleted', sa.Boolean, default=False),
        sa.Column('deleted_at', sa.DateTime),
    )
    op.create_index('idx_studies_created_by', 'studies', ['created_by'])
    op.create_index('idx_studies_created_at', 'studies', ['created_at'])
    op.create_index('idx_studies_is_deleted', 'studies', ['is_deleted'])

    # Study Access (Collaboration)
    op.create_table(
        'study_access',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('user_email', sa.String(255)),
        sa.Column('permission', sa.String(50), nullable=False),  # viewer, editor, admin
        sa.Column('granted_by', sa.String(255), nullable=False),
        sa.Column('granted_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('revoked_at', sa.DateTime),
        sa.Column('is_active', sa.Boolean, default=True),
    )
    op.create_index('idx_study_access_study_id', 'study_access', ['study_id'])
    op.create_index('idx_study_access_user_id', 'study_access', ['user_id'])
    op.create_index('idx_study_access_active', 'study_access', ['is_active'])

    # Notifications
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='CASCADE')),
        sa.Column('type', sa.String(50), nullable=False),  # success, warning, error, info, task
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('link', sa.String(500)),  # URL to related resource
        sa.Column('read', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('read_at', sa.DateTime),
        sa.Column('metadata', JSONB),  # Additional data
    )
    op.create_index('idx_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('idx_notifications_study_id', 'notifications', ['study_id'])
    op.create_index('idx_notifications_read', 'notifications', ['read'])
    op.create_index('idx_notifications_created_at', 'notifications', ['created_at'])

    # Audit Logs (21 CFR Part 11 Compliant)
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('timestamp', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('user_name', sa.String(255)),
        sa.Column('user_email', sa.String(255)),
        sa.Column('study_id', sa.String(255)),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50)),  # study, specification, code, validation, etc.
        sa.Column('resource_id', sa.String(255)),
        sa.Column('details', JSONB),  # Action details
        sa.Column('ip_address', sa.String(50)),
        sa.Column('user_agent', sa.Text),
        sa.Column('session_id', sa.String(255)),
        sa.Column('checksum', sa.String(64)),  # SHA256 for tamper detection
    )
    op.create_index('idx_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('idx_audit_logs_study_id', 'audit_logs', ['study_id'])
    op.create_index('idx_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('idx_audit_logs_timestamp', 'audit_logs', ['timestamp'])
    op.create_index('idx_audit_logs_resource', 'audit_logs', ['resource_type', 'resource_id'])

    # Templates
    op.create_table(
        'templates',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),  # PROMPT, VALIDATION, SUBMISSION
        sa.Column('subcategory', sa.String(100)),  # e.g., ADRG, SDRG, DEFINE_XML
        sa.Column('version', sa.String(50), default='1.0'),
        sa.Column('study_scoped', sa.Boolean, default=False),
        sa.Column('content', sa.Text),  # Template content (if small)
        sa.Column('file_path', sa.String(500)),  # Path to file (if large)
        sa.Column('description', sa.Text),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_by', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
        sa.Column('metadata', JSONB),
    )
    op.create_index('idx_templates_category', 'templates', ['category'])
    op.create_index('idx_templates_active', 'templates', ['is_active'])

    # User Sessions
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('session_id', sa.String(255), unique=True, nullable=False),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='SET NULL')),
        sa.Column('started_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('last_activity_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('ended_at', sa.DateTime),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('user_agent', sa.Text),
        sa.Column('is_active', sa.Boolean, default=True),
    )
    op.create_index('idx_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('idx_user_sessions_session_id', 'user_sessions', ['session_id'])
    op.create_index('idx_user_sessions_active', 'user_sessions', ['is_active'])

    # Study Datasets (track datasets per study)
    op.create_table(
        'study_datasets',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('dataset_name', sa.String(100), nullable=False),  # ADSL, ADAE, ADLB
        sa.Column('dataset_type', sa.String(50), default='ADAM'),  # ADAM, SDTM
        sa.Column('specification_path', sa.String(500)),
        sa.Column('generated_code_path', sa.String(500)),
        sa.Column('status', sa.String(50), default='not_started'),  # not_started, in_progress, completed
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
        sa.Column('metadata', JSONB),
    )
    op.create_index('idx_study_datasets_study_id', 'study_datasets', ['study_id'])
    op.create_index('idx_study_datasets_name', 'study_datasets', ['dataset_name'])

    # Study Specifications (track uploaded specs)
    op.create_table(
        'study_specifications',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('study_id', sa.String(255), sa.ForeignKey('studies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('dataset_id', sa.Integer, sa.ForeignKey('study_datasets.id', ondelete='CASCADE')),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_size', sa.Integer),
        sa.Column('file_hash', sa.String(64)),  # SHA256
        sa.Column('uploaded_by', sa.String(255), nullable=False),
        sa.Column('uploaded_at', sa.DateTime, default=datetime.utcnow, nullable=False),
        sa.Column('is_default', sa.Boolean, default=False),
        sa.Column('variables_count', sa.Integer),
        sa.Column('categorization_complete', sa.Boolean, default=False),
    )
    op.create_index('idx_study_specs_study_id', 'study_specifications', ['study_id'])
    op.create_index('idx_study_specs_dataset_id', 'study_specifications', ['dataset_id'])


def downgrade():
    op.drop_table('study_specifications')
    op.drop_table('study_datasets')
    op.drop_table('user_sessions')
    op.drop_table('templates')
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.drop_table('study_access')
    op.drop_table('studies')
