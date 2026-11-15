import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.automation import (
    AutomationExecutionRead,
    AutomationRuleCreate,
    AutomationRuleRead,
    AutomationRuleUpdate,
    RunAutomationRequest,
    RunAutomationResponse,
)
from app.services.automation_service import AutomationService

router = APIRouter()


@router.get(
    "/rules",
    response_model=List[AutomationRuleRead],
    summary="List GTM automation workflow rules",
)
def list_automation_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AutomationRuleRead]:
    """Retrieve all configured automation rules (seeding defaults on initial setup)."""
    rules = AutomationService.list_rules(db)
    return [AutomationRuleRead.model_validate(r) for r in rules]


@router.post(
    "/rules",
    response_model=AutomationRuleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new automation rule (Admin only)",
)
def create_automation_rule(
    rule_in: AutomationRuleCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> AutomationRuleRead:
    """Create a declarative trigger-condition-action automation workflow."""
    rule = AutomationService.create_rule(db, rule_in, current_user_id=admin_user.id)
    return AutomationRuleRead.model_validate(rule)


@router.patch(
    "/rules/{rule_id}",
    response_model=AutomationRuleRead,
    summary="Update or toggle an automation rule (Admin only)",
)
def update_automation_rule(
    rule_id: uuid.UUID,
    rule_in: AutomationRuleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> AutomationRuleRead:
    """Modify or enable/disable an automation workflow rule."""
    rule = AutomationService.update_rule(db, rule_id, rule_in, current_user_id=admin_user.id)
    return AutomationRuleRead.model_validate(rule)


@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an automation rule (Admin only)",
)
def delete_automation_rule(
    rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> None:
    """Remove an automation rule from the workflow engine."""
    AutomationService.delete_rule(db, rule_id, current_user_id=admin_user.id)


@router.post(
    "/rules/{rule_id}/run",
    response_model=RunAutomationResponse,
    summary="Manually trigger an automation rule across accounts",
)
def trigger_automation_rule(
    rule_id: uuid.UUID,
    payload: Optional[RunAutomationRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunAutomationResponse:
    """Evaluate conditions and execute configured GTM actions on candidate accounts."""
    req = payload or RunAutomationRequest()
    res = AutomationService.run_rule(
        db=db,
        rule_id=rule_id,
        account_ids=req.account_ids,
        limit=req.limit,
        current_user_id=current_user.id,
    )
    return RunAutomationResponse(
        **res,
        message=(
            f"Evaluated {res['evaluated_accounts']} accounts: "
            f"{res['succeeded']} executed, {res['skipped']} skipped, {res['failed']} failed."
        ),
    )


@router.get(
    "/executions",
    response_model=List[AutomationExecutionRead],
    summary="List recent automation rule executions",
)
def list_automation_executions(
    rule_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AutomationExecutionRead]:
    """Retrieve execution audit log for GTM automation workflows."""
    executions = AutomationService.list_executions(db, rule_id=rule_id, limit=limit)
    return [AutomationExecutionRead.model_validate(e) for e in executions]
