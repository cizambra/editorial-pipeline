"""create ideas thumbnails and feedback tables

Revision ID: 0003_content_feedback_and_ideas
Revises: 0002_app_state_and_runs
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_content_feedback_and_ideas"
down_revision = "0002_app_state_and_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "thumbnails",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("article_title", sa.Text(), nullable=False),
        sa.Column("article_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("concept_name", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_hash", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_b64", sa.Text(), nullable=False),
    )
    op.create_table(
        "post_feedback",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("run_title", sa.Text(), nullable=False, server_default=""),
        sa.Column("platform", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("language", sa.String(length=32), nullable=False),
        sa.Column("post_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("preview", sa.Text(), nullable=False, server_default=""),
    )
    op.create_table(
        "ideas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("theme", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False, server_default=""),
        sa.Column("emoji", sa.Text(), nullable=False, server_default=""),
        sa.Column("frequency", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("article_angle", sa.Text(), nullable=False, server_default=""),
        sa.Column("example", sa.Text(), nullable=False, server_default=""),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="reddit"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_feedback_platform", "post_feedback", ["platform"], unique=False)
    op.create_index("idx_ideas_status_source_updated", "ideas", ["status", "source", "updated_at"], unique=False)
    op.create_index("idx_thumbnails_timestamp", "thumbnails", ["timestamp"], unique=False)
    op.create_index(
        "idx_thumbnails_lookup",
        "thumbnails",
        ["article_title", "article_url", "concept_name", "image_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_thumbnails_lookup", table_name="thumbnails")
    op.drop_index("idx_thumbnails_timestamp", table_name="thumbnails")
    op.drop_index("idx_ideas_status_source_updated", table_name="ideas")
    op.drop_index("idx_feedback_platform", table_name="post_feedback")
    op.drop_table("ideas")
    op.drop_table("post_feedback")
    op.drop_table("thumbnails")
