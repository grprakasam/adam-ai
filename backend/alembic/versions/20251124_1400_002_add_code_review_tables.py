"""Add code review and finalization tables

Revision ID: 002
Revises: 001
Create Date: 2025-11-24 14:00:00

Adds tables for consolidated code review workflow:
- code_review_sessions: Track review status for consolidated programs
- code_review_comments: Line-level comments on consolidated code
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create code review tables"""

    # Create code_review_sessions table
    op.create_table(
        'code_review_sessions',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('study_id', sa.String(length=100), nullable=False),
        sa.Column('dataset', sa.String(length=50), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False),
        sa.Column('run_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='not_started'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('study_id', 'dataset', 'language', 'run_id', name='uq_review_session_context')
    )

    # Create indexes for code_review_sessions
    op.create_index('idx_review_session_study', 'code_review_sessions', ['study_id'])
    op.create_index('idx_review_session_status', 'code_review_sessions', ['status'])
    op.create_index('idx_review_session_created', 'code_review_sessions', ['created_at'])

    # Create code_review_comments table
    op.create_table(
        'code_review_comments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('session_id', sa.String(length=50), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=True),
        sa.Column('variable_name', sa.String(length=100), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=False, server_default='System'),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='reviewer'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['code_review_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for code_review_comments
    op.create_index('idx_review_comment_session', 'code_review_comments', ['session_id'])
    op.create_index('idx_review_comment_line', 'code_review_comments', ['line_number'])
    op.create_index('idx_review_comment_status', 'code_review_comments', ['status'])
    op.create_index('idx_review_comment_created', 'code_review_comments', ['created_at'])


def downgrade() -> None:
    """Drop code review tables"""

    # Drop code_review_comments table (drop first due to foreign key)
    op.drop_index('idx_review_comment_created', table_name='code_review_comments')
    op.drop_index('idx_review_comment_status', table_name='code_review_comments')
    op.drop_index('idx_review_comment_line', table_name='code_review_comments')
    op.drop_index('idx_review_comment_session', table_name='code_review_comments')
    op.drop_table('code_review_comments')

    # Drop code_review_sessions table
    op.drop_index('idx_review_session_created', table_name='code_review_sessions')
    op.drop_index('idx_review_session_status', table_name='code_review_sessions')
    op.drop_index('idx_review_session_study', table_name='code_review_sessions')
    op.drop_table('code_review_sessions')
