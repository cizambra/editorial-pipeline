"""add audit log

Revision ID: 0006_audit_log
Revises: 0005_auth_identity_and_invites
Create Date: 2026-03-10
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0006_audit_log"
down_revision = "0005_auth_identity_and_invites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_email", sa.Text(), nullable=False, server_default=""),
        sa.Column("actor_role", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("target_id", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("details_json", sa.Text(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
