import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    trigger_type: Literal[
        "ON_IMPORT_COMPLETE",
        "ON_ENRICHMENT_COMPLETE",
        "ON_SCORE_CALCULATED",
        "SCHEDULED_DAILY",
        "MANUAL",
    ]
    conditions: Dict[str, Any] = Field(default_factory=dict)
    actions: List[str] = Field(..., min_length=1)
    is_active: bool = True


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    trigger_type: Optional[
        Literal[
            "ON_IMPORT_COMPLETE",
            "ON_ENRICHMENT_COMPLETE",
            "ON_SCORE_CALCULATED",
            "SCHEDULED_DAILY",
            "MANUAL",
        ]
    ] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AutomationRuleRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    trigger_type: str
    conditions: Dict[str, Any]
    actions: List[Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AutomationExecutionRead(BaseModel):
    id: uuid.UUID
    rule_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    status: str
    execution_details: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    executed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RunAutomationRequest(BaseModel):
    account_ids: Optional[List[uuid.UUID]] = None
    limit: int = Field(default=50, ge=1, le=200)


class RunAutomationResponse(BaseModel):
    rule_id: uuid.UUID
    rule_name: str
    evaluated_accounts: int
    succeeded: int
    skipped: int
    failed: int
    message: str


class JobExecutionRead(BaseModel):
    id: uuid.UUID
    task_id: str
    job_type: str
    status: str
    retry_count: int
    max_retries: int
    payload: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class JobsSummaryResponse(BaseModel):
    total_jobs: int
    success_jobs: int
    failed_jobs: int
    running_jobs: int
    pending_jobs: int
    items: List[JobExecutionRead]


class NotificationRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: str
    is_read: bool
    entity_type: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    unread_count: int
    items: List[NotificationRead]
