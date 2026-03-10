"""create core auth and queue tables

Revision ID: 0001_core_auth_and_queue
Revises: None
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_core_auth_and_queue"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="operator"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "scheduled_posts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("platform", sa.String(length=64), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("scheduled_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("source_label", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("post_id", sa.Text(), nullable=False, server_default=""),
        sa.Column("error", sa.Text(), nullable=False, server_default=""),
        sa.Column("timezone", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("note_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("scheduled_posts")
    op.drop_table("app_users")
