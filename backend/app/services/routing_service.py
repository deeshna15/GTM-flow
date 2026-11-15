import uuid
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import asc, func, select
from sqlalchemy.orm import Session
from app.models.account import Account, PriorityLevel
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services.audit_service import AuditService
from app.utils.logger import logger


class RoutingService:
    @staticmethod
    def _select_least_loaded_rep(db: Session) -> tuple[User, int]:
        """
        Select the active SALES user with the fewest assigned accounts
        (breaking ties by high-priority count, then creation time).
        Falls back to active ADMIN users if no SALES users exist.
        """
        sales_users = list(
            db.execute(
                select(User)
                .where(User.is_active == True, User.role == UserRole.SALES)
                .order_by(asc(User.created_at))
            )
            .scalars()
            .all()
        )

        candidates = sales_users
        if not candidates:
            candidates = list(
                db.execute(
                    select(User)
                    .where(User.is_active == True)
                    .order_by(asc(User.created_at))
                )
                .scalars()
                .all()
            )

        if not candidates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active users available for account assignment.",
            )

        load_rows = db.execute(
            select(Account.assigned_to, func.count(Account.id))
            .where(Account.assigned_to != None)  # noqa: E711
            .group_by(Account.assigned_to)
        ).all()
        load_map = {row[0]: int(row[1]) for row in load_rows}

        high_rows = db.execute(
            select(Account.assigned_to, func.count(Account.id))
            .where(Account.assigned_to != None, Account.priority == PriorityLevel.HIGH)  # noqa: E711
            .group_by(Account.assigned_to)
        ).all()
        high_map = {row[0]: int(row[1]) for row in high_rows}

        candidates.sort(
            key=lambda u: (load_map.get(u.id, 0), high_map.get(u.id, 0), u.created_at)
        )
        chosen = candidates[0]
        return chosen, load_map.get(chosen.id, 0)

    @staticmethod
    def assign_account(
        db: Session,
        account_id: uuid.UUID,
        target_user_id: Optional[uuid.UUID] = None,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Assign an account either explicitly or via least-loaded rep routing."""
        account = db.execute(
            select(Account).where(Account.id == account_id)
        ).scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account '{account_id}' not found.",
            )

        old_assigned = str(account.assigned_to) if account.assigned_to else None

        if target_user_id is not None:
            user = db.execute(
                select(User).where(User.id == target_user_id, User.is_active == True)
            ).scalar_one_or_none()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Active user '{target_user_id}' not found.",
                )
            strategy = "MANUAL"
            current_load = (
                db.execute(
                    select(func.count(Account.id)).where(Account.assigned_to == user.id)
                ).scalar()
                or 0
            )
        else:
            user, current_load = RoutingService._select_least_loaded_rep(db)
            strategy = "LEAST_LOADED_AUTO"

        account.assigned_to = user.id

        # Create in-app notification for rep
        is_high = account.priority == PriorityLevel.HIGH
        notif = Notification(
            user_id=user.id,
            title=(
                f"High-Priority Lead Assigned: {account.company_name}"
                if is_high
                else f"New Account Assigned: {account.company_name}"
            ),
            message=(
                f"{account.company_name} (Score: {account.lead_score or 'Unscored'}) "
                f"was routed to you via {strategy.lower().replace('_', ' ')}."
            ),
            type="ALERT" if is_high else "INFO",
            entity_type="ACCOUNT",
            entity_id=account.id,
        )
        db.add(notif)
        db.commit()
        db.refresh(account)

        new_load = current_load + (0 if old_assigned == str(user.id) else 1)

        AuditService.log_event(
            db=db,
            action="ASSIGN",
            entity_type="ACCOUNT",
            entity_id=account.id,
            user_id=current_user_id,
            old_values={"assigned_to": old_assigned},
            new_values={
                "assigned_to": str(user.id),
                "assigned_user_name": user.full_name,
                "strategy": strategy,
            },
        )
        db.commit()

        logger.info(
            f"Assigned account '{account.company_name}' -> {user.full_name} ({strategy})"
        )
        return {
            "account_id": account.id,
            "company_name": account.company_name,
            "assigned_to": user.id,
            "assigned_user_name": user.full_name,
            "assigned_user_email": user.email,
            "strategy": strategy,
            "active_account_load": new_load,
        }

    @staticmethod
    def bulk_assign_unassigned(
        db: Session,
        account_ids: Optional[List[uuid.UUID]] = None,
        only_high_priority: bool = False,
        limit: int = 100,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Auto-route unassigned accounts across active sales reps using least-loaded balancing."""
        if account_ids:
            target_ids = account_ids[:limit]
        else:
            stmt = select(Account.id).where(Account.assigned_to == None)  # noqa: E711
            if only_high_priority:
                stmt = stmt.where(Account.priority == PriorityLevel.HIGH)
            target_ids = list(db.execute(stmt.limit(limit)).scalars().all())

        results = []
        for aid in target_ids:
            res = RoutingService.assign_account(
                db=db,
                account_id=aid,
                target_user_id=None,
                current_user_id=current_user_id,
            )
            results.append(res)

        return results
