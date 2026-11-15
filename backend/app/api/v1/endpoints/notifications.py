import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select, update
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.automation import NotificationListResponse, NotificationRead

router = APIRouter()


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications for the authenticated user",
)
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    """Fetch recent alerts and lead assignment notifications for current user."""
    items = list(
        db.execute(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(desc(Notification.created_at))
            .limit(limit)
        )
        .scalars()
        .all()
    )
    unread_count = sum(1 for n in items if not n.is_read)
    return NotificationListResponse(
        unread_count=unread_count,
        items=[NotificationRead.model_validate(n) for n in items],
    )


@router.post(
    "/{notification_id}/read",
    response_model=NotificationRead,
    summary="Mark a notification as read",
)
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationRead:
    notif = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return NotificationRead.model_validate(notif)


@router.post(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all notifications as read",
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    db.commit()
