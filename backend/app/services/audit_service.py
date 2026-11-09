import uuid
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.utils.logger import logger


class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        entity_type: str,
        entity_id: uuid.UUID,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """Record an immutable audit trail entry for entity lifecycle modifications."""
        audit_entry = AuditLog(
            user_id=user_id,
            entity_type=entity_type.upper(),
            entity_id=entity_id,
            action=action.upper(),
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
        )
        db.add(audit_entry)
        # Flush so the record receives an ID without ending the caller transaction
        db.flush()
        logger.debug(
            f"Audit log recorded: {action} {entity_type} {entity_id} by user {user_id}"
        )
        return audit_entry
