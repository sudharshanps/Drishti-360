from fastapi import APIRouter
from app.api import (
    auth,
    compliance,
    crops,
    dashboard,
    health,
    inspection,
    passports,
    pipeline,
    pricing,
    stakeholders,
    traceability,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(crops.router)
api_router.include_router(inspection.router)
api_router.include_router(compliance.router)
api_router.include_router(pricing.router)
api_router.include_router(passports.router)
api_router.include_router(traceability.router)
api_router.include_router(pipeline.router)
api_router.include_router(stakeholders.router)
