"""001_initial_gtmflow_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-11-09 23:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 2. accounts
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("website", sa.String(length=512), nullable=True),
        sa.Column("industry", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("employee_count", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="MANUAL"),
        sa.Column("enrichment_status", sa.String(length=50), nullable=False, server_default="PENDING"),
        sa.Column("lead_score", sa.Integer(), nullable=True),
        sa.Column("priority", sa.String(length=20), nullable=True),
        sa.Column("assigned_to", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accounts_company_name"), "accounts", ["company_name"])
    op.create_index(op.f("ix_accounts_domain"), "accounts", ["domain"])
    op.create_index(op.f("ix_accounts_industry"), "accounts", ["industry"])
    op.create_index(op.f("ix_accounts_country"), "accounts", ["country"])
    op.create_index(op.f("ix_accounts_lead_score"), "accounts", ["lead_score"])
    op.create_index(op.f("ix_accounts_priority"), "accounts", ["priority"])
    op.create_index(op.f("ix_accounts_enrichment_status"), "accounts", ["enrichment_status"])
    op.create_index(op.f("ix_accounts_assigned_to"), "accounts", ["assigned_to"])

    # 3. contacts
    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("job_title", sa.String(length=150), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("seniority", sa.String(length=50), nullable=True),
        sa.Column("linkedin_url", sa.String(length=512), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="MANUAL"),
        sa.Column("verification_status", sa.String(length=50), nullable=False, server_default="UNVERIFIED"),
        sa.Column("is_decision_maker", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("buying_role", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "email", name="uq_account_contact_email"),
    )
    op.create_index(op.f("ix_contacts_account_id"), "contacts", ["account_id"])
    op.create_index(op.f("ix_contacts_email"), "contacts", ["email"])

    # 4. account_sources
    op.create_table(
        "account_sources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=False),
        sa.Column("original_value", sa.Text(), nullable=True),
        sa.Column("source_name", sa.String(length=100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_account_sources_account_id"), "account_sources", ["account_id"])

    # 5. enrichment_records
    op.create_table(
        "enrichment_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False, server_default="CLAUDE"),
        sa.Column("input_snapshot", sa.JSON(), nullable=False),
        sa.Column("output_data", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PENDING"),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_enrichment_records_account_id"), "enrichment_records", ["account_id"])
    op.create_index(op.f("ix_enrichment_records_status"), "enrichment_records", ["status"])

    # 6. lead_scores
    op.create_table(
        "lead_scores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=False),
        sa.Column("industry_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("geography_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("size_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("signal_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("data_completeness_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("explanation", sa.JSON(), nullable=False),
        sa.Column("scoring_version", sa.String(length=50), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_scores_account_id"), "lead_scores", ["account_id"])

    # 7. scoring_configs
    op.create_table(
        "scoring_configs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("weights", sa.JSON(), nullable=False),
        sa.Column("target_industries", sa.JSON(), nullable=False),
        sa.Column("target_geographies", sa.JSON(), nullable=False),
        sa.Column("target_employee_ranges", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. import_jobs
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PENDING"),
        sa.Column("total_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("field_mapping", sa.JSON(), nullable=True),
        sa.Column("error_summary", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_import_jobs_status"), "import_jobs", ["status"])

    # 9. automation_rules
    op.create_table(
        "automation_rules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("trigger_type", sa.String(length=50), nullable=False),
        sa.Column("conditions", sa.JSON(), nullable=False),
        sa.Column("actions", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_automation_rules_trigger_type"), "automation_rules", ["trigger_type"])

    # 10. automation_executions
    op.create_table(
        "automation_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("execution_details", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["rule_id"], ["automation_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_automation_executions_rule_id"), "automation_executions", ["rule_id"])
    op.create_index(op.f("ix_automation_executions_entity_id"), "automation_executions", ["entity_id"])

    # 11. job_executions
    op.create_table(
        "job_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.String(length=255), nullable=False),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PENDING"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_job_executions_task_id"), "job_executions", ["task_id"], unique=True)
    op.create_index(op.f("ix_job_executions_job_type"), "job_executions", ["job_type"])
    op.create_index(op.f("ix_job_executions_status"), "job_executions", ["status"])

    # 12. notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False, server_default="INFO"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"])

    # 13. audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("old_values", sa.JSON(), nullable=True),
        sa.Column("new_values", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"])
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"])
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"])
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("job_executions")
    op.drop_table("automation_executions")
    op.drop_table("automation_rules")
    op.drop_table("import_jobs")
    op.drop_table("scoring_configs")
    op.drop_table("lead_scores")
    op.drop_table("enrichment_records")
    op.drop_table("account_sources")
    op.drop_table("contacts")
    op.drop_table("accounts")
    op.drop_table("users")
