from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    accounts,
    contacts,
    imports,
    enrichment,
    scoring,
    automations,
    jobs,
    notifications,
    users,
    dashboard,
)

api_router = APIRouter()

# Health and readiness probes
api_router.include_router(health.router, prefix="", tags=["Health"])

# Authentication & identity
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Dashboard analytics
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

# Account sub-routes mounted BEFORE accounts.router so static /bulk-* paths precede /{id}
api_router.include_router(enrichment.accounts_enrichment_router, prefix="/accounts", tags=["AI Enrichment"])
api_router.include_router(scoring.accounts_scoring_router, prefix="/accounts", tags=["Lead Scoring & Routing"])

# Core GTM entities
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["Contacts"])

# Data Ingestion Engine
api_router.include_router(imports.router, prefix="/imports", tags=["Imports"])

# AI Intelligence, Scoring, Automation & Monitoring
api_router.include_router(enrichment.router, prefix="/enrichment", tags=["AI Enrichment"])
api_router.include_router(scoring.router, prefix="/scoring", tags=["Lead Scoring & Routing"])
api_router.include_router(automations.router, prefix="/automations", tags=["Automation Center"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs & Monitoring"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(users.router, prefix="/users", tags=["Team Management"])
