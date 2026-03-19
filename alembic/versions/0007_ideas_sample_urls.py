"""add sample_urls to ideas

Revision ID: 0007_ideas_sample_urls
Revises: 0006_audit_log
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0007_ideas_sample_urls"
down_revision = "0006_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("ideas") as batch_op:
        batch_op.add_column(sa.Column("main_struggle", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("sample_urls", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("ideas") as batch_op:
        batch_op.drop_column("sample_urls")
        batch_op.drop_column("main_struggle")
