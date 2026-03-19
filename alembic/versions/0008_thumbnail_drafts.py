"""add is_draft and user_id to thumbnails

Revision ID: 0008_thumbnail_drafts
Revises: 0007_ideas_sample_urls
Create Date: 2026-03-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0008_thumbnail_drafts"
down_revision = "0007_ideas_sample_urls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("thumbnails") as batch_op:
        batch_op.add_column(sa.Column("is_draft", sa.Boolean(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("thumbnails") as batch_op:
        batch_op.drop_column("user_id")
        batch_op.drop_column("is_draft")
