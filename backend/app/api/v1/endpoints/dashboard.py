from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardOverviewResponse
from app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get(
    "/overview",
    response_model=DashboardOverviewResponse,
    summary="Get real-time GTM pipeline analytics and operational overview",
)
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardOverviewResponse:
    """Aggregate live account, contact, score, enrichment, import, and job metrics from PostgreSQL."""
    data = DashboardService.get_overview(db)
    return DashboardOverviewResponse(**data)
