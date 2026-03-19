"""add concept context fields to thumbnails

Revision ID: 0009_thumbnail_concept_context
Revises: 0008_thumbnail_drafts
Create Date: 2026-03-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0009_thumbnail_concept_context"
down_revision = "0008_thumbnail_drafts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("thumbnails") as batch_op:
        batch_op.add_column(sa.Column("concept_scene", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("concept_why", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("concept_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("thumbnails") as batch_op:
        batch_op.drop_column("concept_prompt")
        batch_op.drop_column("concept_why")
        batch_op.drop_column("concept_scene")
