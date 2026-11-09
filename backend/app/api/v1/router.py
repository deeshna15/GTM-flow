from fastapi import APIRouter
from app.api.v1.endpoints import health

api_router = APIRouter()

# Include Phase 1 health and readiness endpoints
api_router.include_router(health.router, prefix="", tags=["Health"])

# Subsequent phases will register:
# - auth.router (/auth)
# - dashboard.router (/dashboard)
# - accounts.router (/accounts)
# - contacts.router (/contacts)
# - imports.router (/imports)
# - enrichment.router (/enrichment)
# - scoring.router (/scoring)
# - automations.router (/automations)
# - jobs.router (/jobs)
# - users.router (/users)
