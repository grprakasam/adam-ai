"""merge_divergent_branches

Revision ID: 5d06d7617ba0
Revises: 002_study_documents_chat, 002
Create Date: 2025-12-06 15:30:42.739092+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5d06d7617ba0"
down_revision: Union[str, None] = ("002_study_documents_chat", "002")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
