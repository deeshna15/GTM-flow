import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.models.account import Account, EnrichmentStatus, PriorityLevel
from app.models.automation import AutomationExecution, AutomationRule
from app.models.job_execution import JobExecution
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.schemas.automation import AutomationRuleCreate, AutomationRuleUpdate
from app.services.audit_service import AuditService
from app.services.enrichment_service import EnrichmentService
from app.services.routing_service import RoutingService
from app.services.scoring_service import ScoringService
from app.utils.logger import logger


DEFAULT_AUTOMATION_RULES = [
    {
        "name": "Auto-Score Newly Enriched Accounts",
        "description": "Deterministically computes 100-pt ICP score after Claude AI enrichment completes.",
        "trigger_type": "ON_ENRICHMENT_COMPLETE",
        "conditions": {"enrichment_status": "COMPLETED"},
        "actions": ["SCORE_ACCOUNT"],
        "is_active": True,
    },
    {
        "name": "Route High-Priority Accounts to Least-Loaded Rep",
        "description": "Automatically assigns unassigned HIGH priority accounts (score >= 80) to the least-loaded sales rep and sends an alert.",
        "trigger_type": "ON_SCORE_CALCULATED",
        "conditions": {"min_score": 80, "unassigned_only": True},
        "actions": ["AUTO_ASSIGN_REP", "CREATE_ALERT"],
        "is_active": True,
    },
    {
        "name": "Enrich & Score Pending Accounts",
        "description": "Scheduled batch workflow that enriches pending accounts, scores them, and routes high-fit leads.",
        "trigger_type": "SCHEDULED_DAILY",
        "conditions": {"enrichment_status": "PENDING"},
        "actions": ["ENRICH_ACCOUNT", "SCORE_ACCOUNT", "AUTO_ASSIGN_REP"],
        "is_active": True,
    },
]


class AutomationService:
    @staticmethod
    def ensure_default_rules(db: Session) -> List[AutomationRule]:
        """Seed default GTM automation workflows if none exist yet."""
        existing = list(
            db.execute(select(AutomationRule).order_by(AutomationRule.created_at))
            .scalars()
            .all()
        )
        if existing:
            return existing

        created: List[AutomationRule] = []
        for rule_def in DEFAULT_AUTOMATION_RULES:
            rule = AutomationRule(**rule_def)
            db.add(rule)
            created.append(rule)
        db.commit()
        for r in created:
            db.refresh(r)
        return created

    @staticmethod
    def list_rules(db: Session) -> List[AutomationRule]:
        """Return all configured automation rules (seeding defaults on first view)."""
        return AutomationService.ensure_default_rules(db)

    @staticmethod
    def create_rule(
        db: Session,
        rule_in: AutomationRuleCreate,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> AutomationRule:
        rule = AutomationRule(
            name=rule_in.name,
            description=rule_in.description,
            trigger_type=rule_in.trigger_type,
            conditions=rule_in.conditions,
            actions=rule_in.actions,
            is_active=rule_in.is_active,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)

        AuditService.log_event(
            db=db,
            action="AUTOMATION_RULE_CREATE",
            entity_type="AUTOMATION_RULE",
            entity_id=rule.id,
            user_id=current_user_id,
            new_values={"name": rule.name, "trigger_type": rule.trigger_type, "actions": rule.actions},
        )
        db.commit()
        return rule

    @staticmethod
    def update_rule(
        db: Session,
        rule_id: uuid.UUID,
        rule_in: AutomationRuleUpdate,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> AutomationRule:
        rule = db.execute(
            select(AutomationRule).where(AutomationRule.id == rule_id)
        ).scalar_one_or_none()
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Automation rule '{rule_id}' not found.",
            )

        update_data = rule_in.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(rule, k, v)

        db.commit()
        db.refresh(rule)

        AuditService.log_event(
            db=db,
            action="AUTOMATION_RULE_UPDATE",
            entity_type="AUTOMATION_RULE",
            entity_id=rule.id,
            user_id=current_user_id,
            new_values=update_data,
        )
        db.commit()
        return rule

    @staticmethod
    def delete_rule(
        db: Session,
        rule_id: uuid.UUID,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> None:
        rule = db.execute(
            select(AutomationRule).where(AutomationRule.id == rule_id)
        ).scalar_one_or_none()
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Automation rule '{rule_id}' not found.",
            )
        name = rule.name
        db.delete(rule)
        db.commit()

        AuditService.log_event(
            db=db,
            action="AUTOMATION_RULE_DELETE",
            entity_type="AUTOMATION_RULE",
            entity_id=rule_id,
            user_id=current_user_id,
            old_values={"name": name},
        )
        db.commit()

    @staticmethod
    def _matches_conditions(account: Account, conditions: Dict[str, Any]) -> bool:
        """Evaluate declarative rule conditions against an Account."""
        if not conditions:
            return True

        min_score = conditions.get("min_score")
        if min_score is not None:
            if account.lead_score is None or account.lead_score < int(min_score):
                return False

        priority = conditions.get("priority")
        if priority:
            acc_pri = account.priority.value if account.priority else None
            if acc_pri != str(priority).upper():
                return False

        enrichment_status = conditions.get("enrichment_status")
        if enrichment_status:
            acc_enr = account.enrichment_status.value if account.enrichment_status else None
            if acc_enr != str(enrichment_status).upper():
                return False

        country = conditions.get("country")
        if country:
            if not account.country or account.country.strip().lower() != str(country).strip().lower():
                return False

        if conditions.get("unassigned_only"):
            if account.assigned_to is not None:
                return False

        return True

    @staticmethod
    def _execute_actions_for_account(
        db: Session,
        rule: AutomationRule,
        account: Account,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> AutomationExecution:
        """Run rule actions against a single matched account and log execution."""
        executed_actions: List[str] = []
        try:
            for action in rule.actions:
                act = str(action).upper()
                if act == "ENRICH_ACCOUNT":
                    EnrichmentService.enrich_account(
                        db=db, account_id=account.id, current_user_id=current_user_id
                    )
                    executed_actions.append("ENRICH_ACCOUNT")
                elif act == "SCORE_ACCOUNT":
                    ScoringService.calculate_and_save_score(
                        db=db, account_id=account.id, current_user_id=current_user_id
                    )
                    executed_actions.append("SCORE_ACCOUNT")
                elif act == "AUTO_ASSIGN_REP":
                    db.refresh(account)
                    if account.assigned_to is None:
                        RoutingService.assign_account(
                            db=db, account_id=account.id, target_user_id=None, current_user_id=current_user_id
                        )
                        executed_actions.append("AUTO_ASSIGN_REP")
                elif act == "CREATE_ALERT":
                    db.refresh(account)
                    target_uid = account.assigned_to or current_user_id
                    if not target_uid:
                        admin_user = db.execute(
                            select(User).where(User.is_active == True).limit(1)
                        ).scalar_one_or_none()
                        target_uid = admin_user.id if admin_user else None
                    if target_uid:
                        notif = Notification(
                            user_id=target_uid,
                            title=f"Automation Alert: {account.company_name}",
                            message=(
                                f"Rule '{rule.name}' flagged {account.company_name} "
                                f"(Score: {account.lead_score or 'N/A'}, Priority: {account.priority.value if account.priority else 'N/A'})."
                            ),
                            type="ALERT",
                            entity_type="ACCOUNT",
                            entity_id=account.id,
                        )
                        db.add(notif)
                        db.commit()
                    executed_actions.append("CREATE_ALERT")

            execution = AutomationExecution(
                rule_id=rule.id,
                entity_type="ACCOUNT",
                entity_id=account.id,
                status="SUCCESS",
                execution_details={
                    "company_name": account.company_name,
                    "actions_executed": executed_actions,
                },
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)
            return execution
        except Exception as exc:
            logger.error(f"Automation rule '{rule.name}' failed for account {account.id}: {exc}")
            execution = AutomationExecution(
                rule_id=rule.id,
                entity_type="ACCOUNT",
                entity_id=account.id,
                status="FAILED",
                execution_details={"actions_attempted": executed_actions},
                error_message=str(exc),
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)
            return execution

    @staticmethod
    def run_rule(
        db: Session,
        rule_id: uuid.UUID,
        account_ids: Optional[List[uuid.UUID]] = None,
        limit: int = 50,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Evaluate and execute an automation rule across candidate accounts."""
        rule = db.execute(
            select(AutomationRule).where(AutomationRule.id == rule_id)
        ).scalar_one_or_none()
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Automation rule '{rule_id}' not found.",
            )

        stmt = select(Account)
        if account_ids:
            stmt = stmt.where(Account.id.in_(account_ids))
        accounts = list(db.execute(stmt.limit(limit)).scalars().all())

        job = JobExecution(
            task_id=f"automation-{rule.id}-{uuid.uuid4()}",
            job_type="ROUTING" if "AUTO_ASSIGN_REP" in rule.actions else "SCORE",
            status="RUNNING",
            payload={"rule_id": str(rule.id), "rule_name": rule.name, "candidate_count": len(accounts)},
        )
        db.add(job)
        db.commit()

        succeeded = 0
        skipped = 0
        failed = 0

        for acc in accounts:
            if not AutomationService._matches_conditions(acc, rule.conditions):
                skipped += 1
                continue
            exec_rec = AutomationService._execute_actions_for_account(
                db=db, rule=rule, account=acc, current_user_id=current_user_id
            )
            if exec_rec.status == "SUCCESS":
                succeeded += 1
            else:
                failed += 1

        job.status = "SUCCESS" if failed == 0 or succeeded > 0 else "FAILED"
        job.completed_at = datetime.now(timezone.utc)
        job.payload = {
            **(job.payload or {}),
            "succeeded": succeeded,
            "skipped": skipped,
            "failed": failed,
        }
        db.commit()

        return {
            "rule_id": rule.id,
            "rule_name": rule.name,
            "evaluated_accounts": len(accounts),
            "succeeded": succeeded,
            "skipped": skipped,
            "failed": failed,
        }

    @staticmethod
    def list_executions(
        db: Session, rule_id: Optional[uuid.UUID] = None, limit: int = 50
    ) -> List[AutomationExecution]:
        stmt = select(AutomationExecution).order_by(desc(AutomationExecution.executed_at))
        if rule_id:
            stmt = stmt.where(AutomationExecution.rule_id == rule_id)
        return list(db.execute(stmt.limit(limit)).scalars().all())
