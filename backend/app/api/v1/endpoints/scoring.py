import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.scoring import (
    AssignAccountRequest,
    AssignAccountResponse,
    BulkAssignRequest,
    BulkAssignResponse,
    BulkScoreRequest,
    BulkScoreResponse,
    LeadScoreRead,
    ScoringConfigRead,
    ScoringConfigUpdate,
    ScoringOverviewResponse,
)
from app.services.routing_service import RoutingService
from app.services.scoring_service import ScoringService

# Mounted under /accounts BEFORE accounts.router
accounts_scoring_router = APIRouter()

# Mounted under /scoring
router = APIRouter()


@accounts_scoring_router.post(
    "/bulk-score",
    response_model=BulkScoreResponse,
    status_code=status.HTTP_200_OK,
    summary="Score multiple or unscored accounts deterministically",
)
def bulk_score_accounts(
    payload: BulkScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkScoreResponse:
    """Calculate deterministic 100-point lead scores for a batch of accounts."""
    res = ScoringService.bulk_score_accounts(
        db=db,
        account_ids=payload.account_ids,
        rescore_all=payload.rescore_all,
        limit=payload.limit,
        current_user_id=current_user.id,
    )
    return BulkScoreResponse(
        **res,
        message=(
            f"Scored {res['scored_count']} accounts "
            f"({res['high_priority_count']} High, {res['medium_priority_count']} Medium, {res['low_priority_count']} Low)."
        ),
    )


@accounts_scoring_router.post(
    "/bulk-assign",
    response_model=BulkAssignResponse,
    status_code=status.HTTP_200_OK,
    summary="Auto-assign unassigned accounts to least-loaded sales reps",
)
def bulk_assign_accounts(
    payload: BulkAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkAssignResponse:
    """Distribute unassigned accounts evenly across active sales reps."""
    assignments = RoutingService.bulk_assign_unassigned(
        db=db,
        account_ids=payload.account_ids,
        only_high_priority=payload.only_high_priority,
        limit=payload.limit,
        current_user_id=current_user.id,
    )
    return BulkAssignResponse(
        assigned_count=len(assignments),
        assignments=[AssignAccountResponse(**a) for a in assignments],
        message=f"Routed {len(assignments)} account(s) via least-loaded balancing.",
    )


@accounts_scoring_router.post(
    "/{account_id}/score",
    response_model=LeadScoreRead,
    status_code=status.HTTP_200_OK,
    summary="Calculate and persist deterministic ICP score for an account",
)
def score_single_account(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadScoreRead:
    """Run deterministic 100-pt lead qualification scoring on an account."""
    lead_score = ScoringService.calculate_and_save_score(
        db=db,
        account_id=account_id,
        current_user_id=current_user.id,
    )
    return LeadScoreRead.model_validate(lead_score)


@accounts_scoring_router.get(
    "/{account_id}/scores",
    response_model=List[LeadScoreRead],
    summary="Get lead score history for an account",
)
def get_account_score_history(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[LeadScoreRead]:
    """Retrieve historical scoring runs and rationales for an account."""
    scores = ScoringService.get_account_scores(db=db, account_id=account_id)
    return [LeadScoreRead.model_validate(s) for s in scores]


@accounts_scoring_router.post(
    "/{account_id}/assign",
    response_model=AssignAccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Assign account manually or via least-loaded rep routing",
)
def assign_single_account(
    account_id: uuid.UUID,
    payload: Optional[AssignAccountRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignAccountResponse:
    """Route an account to a specific sales user or auto-select the least-loaded sales rep."""
    target_uid = payload.user_id if payload else None
    result = RoutingService.assign_account(
        db=db,
        account_id=account_id,
        target_user_id=target_uid,
        current_user_id=current_user.id,
    )
    return AssignAccountResponse(**result)


@router.get(
    "/config",
    response_model=ScoringConfigRead,
    summary="Get active ICP scoring weights and target rules",
)
def get_scoring_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScoringConfigRead:
    """Return active deterministic scoring configuration."""
    config = ScoringService.get_or_create_active_config(db, created_by=current_user.id)
    return ScoringConfigRead.model_validate(config)


@router.patch(
    "/config",
    response_model=ScoringConfigRead,
    summary="Update ICP scoring weights and rules (Admin only)",
)
def update_scoring_config(
    config_in: ScoringConfigUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> ScoringConfigRead:
    """Update scoring dimension weights, target industries, geographies, and company sizes."""
    config = ScoringService.update_config(
        db=db,
        update_in=config_in,
        current_user_id=admin_user.id,
    )
    return ScoringConfigRead.model_validate(config)


@router.get(
    "/overview",
    response_model=ScoringOverviewResponse,
    summary="Get scoring distribution, top scored accounts, and sales rep workloads",
)
def get_scoring_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScoringOverviewResponse:
    """Return leaderboard, tier summary, and sales rep assignment load balance."""
    data = ScoringService.get_scoring_overview(db)
    return ScoringOverviewResponse(**data)
