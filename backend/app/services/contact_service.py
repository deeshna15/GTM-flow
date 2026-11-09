import math
import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func, or_, desc
from fastapi import HTTPException, status
from app.models.contact import Contact
from app.models.account import Account
from app.schemas.contact import ContactCreate, ContactUpdate
from app.services.audit_service import AuditService
from app.utils.logger import logger


class ContactService:
    @staticmethod
    def get_contacts(
        db: Session,
        account_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        is_decision_maker: Optional[bool] = None,
        buying_role: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict[str, Any]:
        """Query contacts with account filter, search, buying role filters, and pagination."""
        page = max(1, page)
        size = min(max(1, size), 100)

        query = select(Contact).options(selectinload(Contact.account))

        if account_id:
            query = query.where(Contact.account_id == account_id)

        if is_decision_maker is not None:
            query = query.where(Contact.is_decision_maker == is_decision_maker)

        if buying_role and buying_role.strip():
            query = query.where(Contact.buying_role.ilike(buying_role.strip()))

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Contact.first_name.ilike(term),
                    Contact.last_name.ilike(term),
                    Contact.email.ilike(term),
                    Contact.job_title.ilike(term),
                    Contact.department.ilike(term),
                )
            )

        count_subquery = query.with_only_columns(func.count(Contact.id)).order_by(None)
        total = db.execute(count_subquery).scalar() or 0

        query = query.order_by(desc(Contact.created_at))
        offset = (page - 1) * size
        items = db.execute(query.offset(offset).limit(size)).scalars().all()
        pages = math.ceil(total / size) if total > 0 else 1

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    @staticmethod
    def get_by_id(db: Session, contact_id: uuid.UUID) -> Contact:
        """Fetch contact by ID or raise 404."""
        stmt = (
            select(Contact)
            .where(Contact.id == contact_id)
            .options(selectinload(Contact.account))
        )
        contact = db.execute(stmt).scalar_one_or_none()
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contact with ID '{contact_id}' was not found.",
            )
        return contact

    @staticmethod
    def create_contact(
        db: Session,
        contact_in: ContactCreate,
        current_user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
    ) -> Contact:
        """Create new contact associated with an account."""
        # Verify parent account exists
        account = db.execute(
            select(Account).where(Account.id == contact_in.account_id)
        ).scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent account with ID '{contact_in.account_id}' does not exist.",
            )

        # Check duplicate email on same account
        if contact_in.email:
            existing = db.execute(
                select(Contact).where(
                    Contact.account_id == contact_in.account_id,
                    Contact.email.ilike(contact_in.email.strip()),
                )
            ).scalar_one_or_none()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A contact with email '{contact_in.email}' already exists for this company.",
                )

        contact = Contact(
            account_id=contact_in.account_id,
            first_name=contact_in.first_name.strip(),
            last_name=contact_in.last_name.strip(),
            email=contact_in.email.strip().lower() if contact_in.email else None,
            job_title=contact_in.job_title.strip() if contact_in.job_title else None,
            department=contact_in.department.strip() if contact_in.department else None,
            seniority=contact_in.seniority.strip() if contact_in.seniority else None,
            linkedin_url=contact_in.linkedin_url.strip() if contact_in.linkedin_url else None,
            source=contact_in.source,
            is_decision_maker=contact_in.is_decision_maker,
            buying_role=contact_in.buying_role.strip() if contact_in.buying_role else None,
            verification_status="UNVERIFIED",
        )

        db.add(contact)
        db.commit()
        db.refresh(contact)

        AuditService.log_event(
            db=db,
            entity_type="CONTACT",
            entity_id=contact.id,
            action="CREATE",
            user_id=current_user_id,
            new_values={
                "name": f"{contact.first_name} {contact.last_name}",
                "email": contact.email,
                "account_id": str(contact.account_id),
                "buying_role": contact.buying_role,
            },
            ip_address=ip_address,
        )
        db.commit()

        logger.info(f"Contact created: '{contact.first_name} {contact.last_name}' [ID: {contact.id}]")
        return contact

    @staticmethod
    def update_contact(
        db: Session,
        contact_id: uuid.UUID,
        contact_in: ContactUpdate,
        current_user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
    ) -> Contact:
        """Update contact fields with audit trail diff."""
        contact = ContactService.get_by_id(db, contact_id)
        update_data = contact_in.model_dump(exclude_unset=True)

        if not update_data:
            return contact

        # If email updated, verify duplicate
        if "email" in update_data and update_data["email"]:
            new_email = update_data["email"].strip().lower()
            if new_email != contact.email:
                existing = db.execute(
                    select(Contact).where(
                        Contact.account_id == contact.account_id,
                        Contact.email.ilike(new_email),
                    )
                ).scalar_one_or_none()
                if existing and existing.id != contact.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"A contact with email '{new_email}' already exists for this company.",
                    )
                update_data["email"] = new_email

        old_values: Dict[str, Any] = {}
        new_values: Dict[str, Any] = {}

        for field, value in update_data.items():
            curr_val = getattr(contact, field)
            if curr_val != value:
                old_values[field] = curr_val
                new_values[field] = value
                setattr(contact, field, value)

        if new_values:
            AuditService.log_event(
                db=db,
                entity_type="CONTACT",
                entity_id=contact.id,
                action="UPDATE",
                user_id=current_user_id,
                old_values=old_values,
                new_values=new_values,
                ip_address=ip_address,
            )

        db.commit()
        db.refresh(contact)
        return contact

    @staticmethod
    def delete_contact(
        db: Session,
        contact_id: uuid.UUID,
        current_user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Delete contact with audit logging."""
        contact = ContactService.get_by_id(db, contact_id)

        AuditService.log_event(
            db=db,
            entity_type="CONTACT",
            entity_id=contact.id,
            action="DELETE",
            user_id=current_user_id,
            old_values={
                "name": f"{contact.first_name} {contact.last_name}",
                "email": contact.email,
                "account_id": str(contact.account_id),
            },
            ip_address=ip_address,
        )

        db.delete(contact)
        db.commit()
        logger.info(f"Contact deleted: '{contact.first_name} {contact.last_name}' [ID: {contact_id}]")
