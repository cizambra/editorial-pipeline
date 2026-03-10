"""create quotes and substack tables

Revision ID: 0004_quotes_and_substack_tables
Revises: 0003_content_feedback_and_ideas
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0004_quotes_and_substack_tables"
down_revision = "0003_content_feedback_and_ideas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "article_quotes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("timestamp", sa.Text(), nullable=False, server_default=""),
        sa.Column("article_title", sa.Text(), nullable=False, server_default=""),
        sa.Column("article_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("quote_text", sa.Text(), nullable=False),
        sa.Column("context", sa.Text(), nullable=False, server_default=""),
        sa.Column("quote_type", sa.String(length=64), nullable=False, server_default="insight"),
        sa.Column("shared", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("signal", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column("linkedin_post", sa.Text(), nullable=False, server_default=""),
        sa.Column("threads_post", sa.Text(), nullable=False, server_default=""),
        sa.Column("instagram_post", sa.Text(), nullable=False, server_default=""),
    )
    op.create_table(
        "substack_subscribers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=False, server_default=""),
        sa.Column("photo_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("subscription_interval", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("is_subscribed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_comp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activity_rating", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("subscription_created_at", sa.Text(), nullable=False, server_default=""),
        sa.Column("total_revenue_generated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("subscription_country", sa.Text(), nullable=False, server_default=""),
        sa.Column("detail_json", sa.Text(), nullable=False, server_default=""),
        sa.Column("synced_at", sa.Text(), nullable=False, server_default=""),
        sa.Column("detail_synced_at", sa.Text(), nullable=False, server_default=""),
    )
    op.create_table(
        "substack_batches",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.Text(), nullable=False, server_default=""),
        sa.Column("note_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "substack_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.Text(), nullable=False, server_default=""),
        sa.Column("issue", sa.Text(), nullable=False),
        sa.Column("intent", sa.Text(), nullable=False),
        sa.Column("note_text", sa.Text(), nullable=False),
        sa.Column("shared", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("signal", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column("linkedin_post", sa.Text(), nullable=False, server_default=""),
        sa.Column("threads_post", sa.Text(), nullable=False, server_default=""),
        sa.Column("instagram_post", sa.Text(), nullable=False, server_default=""),
    )
    op.create_index("idx_quotes_run", "article_quotes", ["run_id"], unique=False)
    op.create_index("idx_sub_activity", "substack_subscribers", ["activity_rating"], unique=False)
    op.create_index("idx_sub_interval", "substack_subscribers", ["subscription_interval"], unique=False)
    op.create_index("idx_sn_batch", "substack_notes", ["batch_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_sn_batch", table_name="substack_notes")
    op.drop_index("idx_sub_interval", table_name="substack_subscribers")
    op.drop_index("idx_sub_activity", table_name="substack_subscribers")
    op.drop_index("idx_quotes_run", table_name="article_quotes")
    op.drop_table("substack_notes")
    op.drop_table("substack_batches")
    op.drop_table("substack_subscribers")
    op.drop_table("article_quotes")
