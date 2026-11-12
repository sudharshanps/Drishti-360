from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.schemas.domain import HealthOut

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthOut)
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    dialect = "postgresql" if "postgres" in settings.DATABASE_URL else "sqlite_local"
    return HealthOut(
        status="ok",
        service=settings.APP_NAME,
        database_dialect=dialect,
        environment=settings.APP_ENV,
        timestamp=datetime.utcnow(),
    )
