import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import asc, func, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_admin
from app.database import get_db
from app.models.account import Account
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService

router = APIRouter()


class UserWithLoad(UserRead):
    assigned_accounts_count: int = 0


@router.get(
    "",
    response_model=List[UserWithLoad],
    summary="List team members and their assigned account load",
)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[UserWithLoad]:
    """Return active and inactive team members with account assignment counts."""
    users = list(
        db.execute(select(User).order_by(asc(User.created_at))).scalars().all()
    )
    load_rows = db.execute(
        select(Account.assigned_to, func.count(Account.id))
        .where(Account.assigned_to != None)  # noqa: E711
        .group_by(Account.assigned_to)
    ).all()
    load_map = {row[0]: int(row[1]) for row in load_rows}

    result: List[UserWithLoad] = []
    for u in users:
        item = UserWithLoad.model_validate(u)
        item.assigned_accounts_count = load_map.get(u.id, 0)
        result.append(item)
    return result


@router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Invite / create a new team member (Admin only)",
)
def create_team_member(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> UserRead:
    """Create a new SALES or ADMIN team account."""
    user = AuthService.register_user(db, user_in)
    AuditService.log_event(
        db=db,
        action="USER_CREATE",
        entity_type="USER",
        entity_id=user.id,
        user_id=admin_user.id,
        new_values={"email": user.email, "role": user.role.value},
    )
    db.commit()
    return UserRead.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    summary="Update team member role or active status (Admin only)",
)
def update_team_member(
    user_id: uuid.UUID,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> UserRead:
    """Update a team member's name, role, or activation state."""
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )

    update_data = user_in.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(user, k, v)

    db.commit()
    db.refresh(user)

    AuditService.log_event(
        db=db,
        action="USER_UPDATE",
        entity_type="USER",
        entity_id=user.id,
        user_id=admin_user.id,
        new_values=update_data,
    )
    db.commit()
    return UserRead.model_validate(user)
