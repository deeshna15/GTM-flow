import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.account import PriorityLevel
from app.models.user import User
from app.schemas.account import (
    AccountCreate,
    AccountUpdate,
    AccountRead,
    AccountDetail,
    AccountPagination,
)
from app.schemas.audit_log import AuditLogPagination
from app.services.account_service import AccountService
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=AccountPagination, summary="List accounts with search and filtering")
def list_accounts(
    search: Optional[str] = Query(None, description="Search company name or domain"),
    country: Optional[str] = Query(None, description="Filter by country"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    priority: Optional[PriorityLevel] = Query(None, description="Filter by HIGH, MEDIUM, LOW"),
    sort_by: str = Query("created_at", description="Field to sort by: lead_score, employee_count, company_name, created_at"),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccountPagination:
    """Retrieve paginated accounts with multi-attribute filtering and dynamic sorting."""
    result = AccountService.get_accounts(
        db=db,
        search=search,
        country=country,
        industry=industry,
        priority=priority,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        size=size,
    )
    return AccountPagination(**result)


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED, summary="Create an account")
def create_account(
    account_in: AccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccountRead:
    """Create a new company account with automated domain normalization and audit logging."""
    ip_address = request.client.host if request.client else None
    account = AccountService.create_account(
        db=db,
        account_in=account_in,
        current_user_id=current_user.id,
        ip_address=ip_address,
    )
    return AccountRead.model_validate(account)


@router.get("/{id}", response_model=AccountDetail, summary="Get full account details")
def get_account_detail(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccountDetail:
    """Fetch complete account profile with contacts, enrichment history, and lead score."""
    account = AccountService.get_by_id(db, id)
    return AccountDetail.model_validate(account)


@router.patch("/{id}", response_model=AccountRead, summary="Update account fields")
def update_account(
    id: uuid.UUID,
    account_in: AccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccountRead:
    """Update company details and record field-level diff in audit trail."""
    ip_address = request.client.host if request.client else None
    account = AccountService.update_account(
        db=db,
        account_id=id,
        account_in=account_in,
        current_user_id=current_user.id,
        ip_address=ip_address,
    )
    return AccountRead.model_validate(account)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete account")
def delete_account(
    id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an account and its cascade dependents."""
    ip_address = request.client.host if request.client else None
    AccountService.delete_account(
        db=db,
        account_id=id,
        current_user_id=current_user.id,
        ip_address=ip_address,
    )


@router.get("/{id}/activity", response_model=AuditLogPagination, summary="Get account activity timeline")
def get_account_activity(
    id: uuid.UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuditLogPagination:
    """Retrieve audit history log for an account."""
    # Ensure account exists
    AccountService.get_by_id(db, id)
    activity = AccountService.get_account_activity(db=db, account_id=id, page=page, size=size)
    return AuditLogPagination(**activity)
