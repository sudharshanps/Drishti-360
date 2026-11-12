from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import UPLOAD_DIR, settings
from app.core.exceptions import register_exception_handlers
from app.database.session import Base, SessionLocal, engine
from app.services.seed_service import seed_foundation_data, sync_production_passport_urls

show_docs = settings.ENABLE_DOCS and (not settings.is_production)
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="DRISHTI 360 – AI-Powered Farm-to-Market Intelligence Platform API",
    docs_url="/docs" if show_docs else None,
    redoc_url="/redoc" if show_docs else None,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

register_exception_handlers(app)
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_foundation_data(db)
        sync_production_passport_urls(db)
    finally:
        db.close()
    try:
        from app.services.ocr_service import get_ocr_engine
        get_ocr_engine()
    except Exception:
        pass
