"""Initial database schema

Revision ID: 001
Revises:
Create Date: 2025-11-20 15:30:00

Creates all tables for ADAM AI application:
- User management
- Audit trail (21 CFR Part 11 compliant)
- Electronic signatures
- Code snippets
- Datasets and variables
- Define-XML metadata
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='statistician'),
        sa.Column('permissions', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('password_changed_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('account_locked_until', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('email')
    )
    op.create_index('idx_user_username', 'users', ['username'])
    op.create_index('idx_user_email', 'users', ['email'])
    op.create_index('idx_user_active', 'users', ['is_active'])

    # Create audit_entries table (21 CFR Part 11 compliant)
    op.create_table(
        'audit_entries',
        sa.Column('audit_id', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=True),
        sa.Column('resource_id', sa.String(length=100), nullable=True),
        sa.Column('before_state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('after_state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('regulatory_reason', sa.Text(), nullable=True),
        sa.Column('cfr_part_11_compliant', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('previous_hash', sa.String(length=64), nullable=True),
        sa.Column('current_hash', sa.String(length=64), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('session_id', sa.String(length=100), nullable=True),
        sa.CheckConstraint('current_hash IS NOT NULL', name='audit_hash_required'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('audit_id'),
        sa.UniqueConstraint('current_hash')
    )
    op.create_index('idx_audit_timestamp', 'audit_entries', ['timestamp'])
    op.create_index('idx_audit_user', 'audit_entries', ['user_id'])
    op.create_index('idx_audit_action', 'audit_entries', ['action'])
    op.create_index('idx_audit_resource', 'audit_entries', ['resource_type', 'resource_id'])
    op.create_index('idx_audit_hash', 'audit_entries', ['current_hash'])

    # Create electronic_signatures table (21 CFR Part 11.50 compliant)
    op.create_table(
        'electronic_signatures',
        sa.Column('signature_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('signed_at', sa.DateTime(), nullable=False),
        sa.Column('signature_meaning', sa.String(length=50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('resource_id', sa.String(length=100), nullable=False),
        sa.Column('signature_hash', sa.String(length=64), nullable=False),
        sa.Column('document_hash', sa.String(length=64), nullable=False),
        sa.Column('is_valid', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_by', sa.String(length=50), nullable=True),
        sa.Column('revocation_reason', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.CheckConstraint('LENGTH(reason) >= 10', name='signature_reason_min_length'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('signature_id')
    )
    op.create_index('idx_signature_user', 'electronic_signatures', ['user_id'])
    op.create_index('idx_signature_resource', 'electronic_signatures', ['resource_type', 'resource_id'])
    op.create_index('idx_signature_timestamp', 'electronic_signatures', ['signed_at'])
    op.create_index('idx_signature_meaning', 'electronic_signatures', ['signature_meaning'])

    # Create datasets table
    op.create_table(
        'datasets',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('label', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('dataset_class', sa.String(length=50), nullable=False, server_default='ADAM'),
        sa.Column('structure', sa.Text(), nullable=False),
        sa.Column('purpose', sa.String(length=100), nullable=False, server_default='Analysis'),
        sa.Column('study_id', sa.String(length=100), nullable=True),
        sa.Column('protocol', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='in_progress'),
        sa.Column('finalized', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_dataset_name', 'datasets', ['name'])
    op.create_index('idx_dataset_study', 'datasets', ['study_id'])
    op.create_index('idx_dataset_status', 'datasets', ['status'])

    # Create variables table
    op.create_table(
        'variables',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('label', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('dataset_id', sa.String(length=50), nullable=False),
        sa.Column('variable_type', sa.String(length=50), nullable=False),
        sa.Column('length', sa.Integer(), nullable=True),
        sa.Column('format', sa.String(length=50), nullable=True),
        sa.Column('origin', sa.String(length=50), nullable=False, server_default='Derived'),
        sa.Column('source', sa.Text(), nullable=True),
        sa.Column('codelist', sa.String(length=100), nullable=True),
        sa.Column('method', sa.Text(), nullable=True),
        sa.Column('method_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('dataset_id', 'name', name='uq_dataset_variable')
    )
    op.create_index('idx_variable_name', 'variables', ['name'])
    op.create_index('idx_variable_dataset', 'variables', ['dataset_id'])

    # Create code_snippets table
    op.create_table(
        'code_snippets',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('language', sa.String(length=20), nullable=False, server_default='R'),
        sa.Column('variable_name', sa.String(length=100), nullable=False),
        sa.Column('variable_label', sa.Text(), nullable=True),
        sa.Column('variable_type', sa.String(length=50), nullable=True),
        sa.Column('dataset_name', sa.String(length=100), nullable=True),
        sa.Column('llm_provider', sa.String(length=50), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('prompt_used', sa.Text(), nullable=True),
        sa.Column('validation_status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('validation_results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('cdisc_compliant', sa.Boolean(), nullable=True),
        sa.Column('rules_passed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rules_failed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('errors', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('warnings', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='generated'),
        sa.Column('approved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('approved_by', sa.String(length=50), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_snippet_variable', 'code_snippets', ['variable_name'])
    op.create_index('idx_snippet_dataset', 'code_snippets', ['dataset_name'])
    op.create_index('idx_snippet_status', 'code_snippets', ['status'])
    op.create_index('idx_snippet_approved', 'code_snippets', ['approved'])
    op.create_index('idx_snippet_created', 'code_snippets', ['created_at'])

    # Create define_xml table
    op.create_table(
        'define_xml',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('study_id', sa.String(length=100), nullable=False),
        sa.Column('study_name', sa.String(length=255), nullable=False),
        sa.Column('protocol', sa.String(length=100), nullable=False),
        sa.Column('sponsor', sa.String(length=255), nullable=True),
        sa.Column('adam_ig_version', sa.String(length=20), nullable=False, server_default='2.1'),
        sa.Column('xml_content', sa.Text(), nullable=False),
        sa.Column('validated', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('validation_results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('generated_by', sa.String(length=50), nullable=False),
        sa.Column('generated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['generated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_define_study', 'define_xml', ['study_id'])
    op.create_index('idx_define_generated', 'define_xml', ['generated_at'])


def downgrade() -> None:
    op.drop_index('idx_define_generated', table_name='define_xml')
    op.drop_index('idx_define_study', table_name='define_xml')
    op.drop_table('define_xml')

    op.drop_index('idx_snippet_created', table_name='code_snippets')
    op.drop_index('idx_snippet_approved', table_name='code_snippets')
    op.drop_index('idx_snippet_status', table_name='code_snippets')
    op.drop_index('idx_snippet_dataset', table_name='code_snippets')
    op.drop_index('idx_snippet_variable', table_name='code_snippets')
    op.drop_table('code_snippets')

    op.drop_index('idx_variable_dataset', table_name='variables')
    op.drop_index('idx_variable_name', table_name='variables')
    op.drop_table('variables')

    op.drop_index('idx_dataset_status', table_name='datasets')
    op.drop_index('idx_dataset_study', table_name='datasets')
    op.drop_index('idx_dataset_name', table_name='datasets')
    op.drop_table('datasets')

    op.drop_index('idx_signature_meaning', table_name='electronic_signatures')
    op.drop_index('idx_signature_timestamp', table_name='electronic_signatures')
    op.drop_index('idx_signature_resource', table_name='electronic_signatures')
    op.drop_index('idx_signature_user', table_name='electronic_signatures')
    op.drop_table('electronic_signatures')

    op.drop_index('idx_audit_hash', table_name='audit_entries')
    op.drop_index('idx_audit_resource', table_name='audit_entries')
    op.drop_index('idx_audit_action', table_name='audit_entries')
    op.drop_index('idx_audit_user', table_name='audit_entries')
    op.drop_index('idx_audit_timestamp', table_name='audit_entries')
    op.drop_table('audit_entries')

    op.drop_index('idx_user_active', table_name='users')
    op.drop_index('idx_user_email', table_name='users')
    op.drop_index('idx_user_username', table_name='users')
    op.drop_table('users')
