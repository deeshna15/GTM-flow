import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    entity_type: str
    entity_id: uuid.UUID
    action: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogPagination(BaseModel):
    items: List[AuditLogRead]
    total: int
    page: int
    size: int
