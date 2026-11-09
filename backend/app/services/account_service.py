import math
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func, or_, desc, asc
from fastapi import HTTPException, status
from app.models.account import Account, PriorityLevel, EnrichmentStatus
from app.models.audit_log import AuditLog
from app.schemas.account import AccountCreate, AccountUpdate
from app.services.normalization_service import NormalizationService
from app.services.audit_service import AuditService
from app.utils.logger import logger


class AccountService:
    @staticmethod
    def get_accounts(
        db: Session,
        search: Optional[str] = None,
        country: Optional[str] = None,
        industry: Optional[str] = None,
        priority: Optional[PriorityLevel] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        size: int = 20,
    ) -> Dict[str, Any]:
        """
        Query accounts with multi-attribute filtering, search, dynamic sorting, and pagination.
        """
        page = max(1, page)
        size = min(max(1, size), 100)

        query = select(Account).options(selectinload(Account.assigned_user))

        # Search filter (company name or domain)
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Account.company_name.ilike(term),
                    Account.domain.ilike(term),
                )
            )

        # Exact match filters
        if country and country.strip():
            query = query.where(Account.country.ilike(country.strip()))
        if industry and industry.strip():
            query = query.where(Account.industry.ilike(industry.strip()))
        if priority:
            query = query.where(Account.priority == priority)

        # Count total matching rows
        count_subquery = query.with_only_columns(func.count(Account.id)).order_by(None)
        total = db.execute(count_subquery).scalar() or 0

        # Dynamic sorting
        sort_column_map = {
            "company_name": Account.company_name,
            "lead_score": Account.lead_score,
            "employee_count": Account.employee_count,
            "created_at": Account.created_at,
            "updated_at": Account.updated_at,
        }
        col = sort_column_map.get(sort_by, Account.created_at)
        order_fn = desc if sort_order.lower() == "desc" else asc
        query = query.order_by(order_fn(col).nulls_last())

        # Pagination offset and limit
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)

        items = db.execute(query).scalars().all()
        pages = math.ceil(total / size) if total > 0 else 1

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    @staticmethod
    def get_by_id(db: Session, account_id: uuid.UUID) -> Account:
        """Fetch account by primary key or raise 404."""
        stmt = (
            select(Account)
            .where(Account.id == account_id)
            .options(
                selectinload(Account.assigned_user),
                selectinload(Account.contacts),
                selectinload(Account.enrichment_records),
                selectinload(Account.lead_scores),
                selectinload(Account.sources),
            )
        )
        account = db.execute(stmt).scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account with ID '{account_id}' was not found.",
            )
        return account

    @staticmethod
    def get_by_domain(db: Session, domain: str) -> Optional[Account]:
        """Look up existing account by exact normalized domain."""
        norm_domain = NormalizationService.normalize_domain(domain)
        if not norm_domain:
            return None
        stmt = select(Account).where(Account.domain == norm_domain)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def create_account(
        db: Session,
        account_in: AccountCreate,
        current_user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
    ) -> Account:
        """Create new company account with normalized domain and duplicate detection."""
        norm_domain = NormalizationService.normalize_domain(account_in.domain or account_in.website)

        # Check domain collision if domain is provided
        if norm_domain:
            existing = AccountService.get_by_domain(db, norm_domain)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"An account with normalized domain '{norm_domain}' already exists (ID: {existing.id}).",
                )

        account = Account(
            company_name=NormalizationService.normalize_company_name(account_in.company_name),
            domain=norm_domain,
            website=NormalizationService.normalize_website(account_in.website or norm_domain),
            industry=account_in.industry.strip() if account_in.industry else None,
            country=account_in.country.strip() if account_in.country else None,
            employee_count=account_in.employee_count,
            description=account_in.description,
            source=account_in.source,
            enrichment_status=EnrichmentStatus.PENDING,
            assigned_to=account_in.assigned_to,
        )

        db.add(account)
        db.commit()
        db.refresh(account)

        # Audit log creation
        AuditService.log_event(
            db=db,
            entity_type="ACCOUNT",
            entity_id=account.id,
            action="CREATE",
            user_id=current_user_id,
            new_values={
                "company_name": account.company_name,
                "domain": account.domain,
                "source": account.source,
            },
            ip_address=ip_address,
        )
        db.commit()

        logger.info(f"Account created: '{account.company_name}' ({account.domain}) [ID: {account.id}]")
        return account

    @staticmethod
    def update_account(
        db: Session,
        account_id: uuid.UUID,
        account_in: AccountUpdate,
        current_user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
    ) -> Account:
        """Update existing account fields and record field-level diff in audit log."""
        account = AccountService.get_by_id(db, account_id)
        update_data = account_in.model_dump(exclude_unset=True)

        if not update_data:
            return account

        old_values: Dict[str, Any] = {}
        new_values: Dict[str, Any] = {}

        # Handle domain uniqueness if domain is being updated
        if "domain" in update_data and update_data["domain"]:
            new_domain = NormalizationService.normalize_domain(update_data["domain"])
            if new_domain != account.domain:
                existing = AccountService.get_by_domain(db, new_domain)
                if existing and existing.id != account.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"An account with domain '{new_domain}' already exists.",
                    )
                update_data["domain"] = new_domain

        for field, value in update_data.items():
            curr_val = getattr(account, field)
            if curr_val != value:
                old_values[field] = str(curr_val) if isinstance(curr_val, (uuid.UUID, PriorityLevel, EnrichmentStatus)) else curr_val
                new_values[field] = str(value) if isinstance(value, (uuid.UUID, PriorityLevel, EnrichmentStatus)) else value
                setattr(account, field, value)

        if new_values:
            AuditService.log_event(
                db=db,
                entity_type="ACCOUNT",
                entity_id=account.id,
                action="UPDATE",
                user_id=current_user_id,
                old_values=old_values,
                new_values=new_values,
                ip_address=ip_address,
            )

        db.commit()
        db.refresh(account)
        logger.info(f"Account updated: '{account.company_name}' [ID: {account.id}]")
        return account

    @staticmethod
    def delete_account(
        db: Session,
        account_id: uuid.UUID,
        current_user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Delete an account and its cascade dependents with audit logging."""
        account = AccountService.get_by_id(db, account_id)

        AuditService.log_event(
            db=db,
            entity_type="ACCOUNT",
            entity_id=account.id,
            action="DELETE",
            user_id=current_user_id,
            old_values={
                "company_name": account.company_name,
                "domain": account.domain,
            },
            ip_address=ip_address,
        )

        db.delete(account)
        db.commit()
        logger.info(f"Account deleted: '{account.company_name}' [ID: {account_id}]")

    @staticmethod
    def get_account_activity(
        db: Session,
        account_id: uuid.UUID,
        page: int = 1,
        size: int = 20,
    ) -> Dict[str, Any]:
        """Fetch audit log history timeline specifically for an account."""
        page = max(1, page)
        size = min(max(1, size), 100)

        query = (
            select(AuditLog)
            .where(AuditLog.entity_id == account_id)
            .order_by(desc(AuditLog.created_at))
        )

        count_subquery = query.with_only_columns(func.count(AuditLog.id)).order_by(None)
        total = db.execute(count_subquery).scalar() or 0

        items = db.execute(query.offset((page - 1) * size).limit(size)).scalars().all()

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
        }
