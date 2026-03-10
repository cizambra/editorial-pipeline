"""create app state and run history tables

Revision ID: 0002_app_state_and_runs
Revises: 0001_core_auth_and_queue
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_app_state_and_runs"
down_revision = "0001_core_auth_and_queue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_config",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("value_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "pipeline_state",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("value_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("article_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tags", sa.Text(), nullable=False, server_default=""),
    )
    op.create_table(
        "image_costs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("source", sa.String(length=128), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
    )
    op.create_index("idx_runs_timestamp", "runs", ["timestamp"], unique=False)
    op.create_index("idx_runs_article_url", "runs", ["article_url"], unique=False)
    op.create_index("idx_image_costs_source", "image_costs", ["source"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_image_costs_source", table_name="image_costs")
    op.drop_index("idx_runs_article_url", table_name="runs")
    op.drop_index("idx_runs_timestamp", table_name="runs")
    op.drop_table("image_costs")
    op.drop_table("runs")
    op.drop_table("pipeline_state")
    op.drop_table("app_config")
