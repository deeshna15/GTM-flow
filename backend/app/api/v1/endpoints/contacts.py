import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.contact import (
    ContactCreate,
    ContactUpdate,
    ContactRead,
    ContactPagination,
)
from app.services.contact_service import ContactService
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=ContactPagination, summary="List contacts")
def list_contacts(
    account_id: Optional[uuid.UUID] = Query(None, description="Filter by company account ID"),
    search: Optional[str] = Query(None, description="Search name, email, job title, department"),
    is_decision_maker: Optional[bool] = Query(None, description="Filter decision makers"),
    buying_role: Optional[str] = Query(None, description="Filter by buying role: CHAMPION, DECISION_MAKER, etc."),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ContactPagination:
    """Retrieve contacts with account filtering and buying committee identification."""
    result = ContactService.get_contacts(
        db=db,
        account_id=account_id,
        search=search,
        is_decision_maker=is_decision_maker,
        buying_role=buying_role,
        page=page,
        size=size,
    )
    return ContactPagination(**result)


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED, summary="Create a contact")
def create_contact(
    contact_in: ContactCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ContactRead:
    """Create a new contact associated with a company account."""
    ip_address = request.client.host if request.client else None
    contact = ContactService.create_contact(
        db=db,
        contact_in=contact_in,
        current_user_id=current_user.id,
        ip_address=ip_address,
    )
    return ContactRead.model_validate(contact)


@router.get("/{id}", response_model=ContactRead, summary="Get contact details")
def get_contact(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ContactRead:
    """Retrieve details for a specific contact."""
    contact = ContactService.get_by_id(db, id)
    return ContactRead.model_validate(contact)


@router.patch("/{id}", response_model=ContactRead, summary="Update contact")
def update_contact(
    id: uuid.UUID,
    contact_in: ContactUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ContactRead:
    """Update contact attributes, job title, or buying committee status."""
    ip_address = request.client.host if request.client else None
    contact = ContactService.update_contact(
        db=db,
        contact_id=id,
        contact_in=contact_in,
        current_user_id=current_user.id,
        ip_address=ip_address,
    )
    return ContactRead.model_validate(contact)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete contact")
def delete_contact(
    id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a contact record."""
    ip_address = request.client.host if request.client else None
    ContactService.delete_contact(
        db=db,
        contact_id=id,
        current_user_id=current_user.id,
        ip_address=ip_address,
    )
