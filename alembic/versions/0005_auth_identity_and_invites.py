"""add auth identity mapping and invites

Revision ID: 0005_auth_identity_and_invites
Revises: 0004_quotes_and_substack_tables
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0005_auth_identity_and_invites"
down_revision = "0004_quotes_and_substack_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("app_users", sa.Column("auth_provider", sa.String(length=32), nullable=False, server_default="local"))
    op.add_column("app_users", sa.Column("auth_subject", sa.Text(), nullable=False, server_default=""))
    op.create_table(
        "user_invites",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="operator"),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("user_invites")
    op.drop_column("app_users", "auth_subject")
    op.drop_column("app_users", "auth_provider")
