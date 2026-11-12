import os
from pathlib import Path
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BASE_DIR.parent
_env_upload_dir = os.getenv("UPLOAD_DIR", "").strip()
UPLOAD_DIR = Path(_env_upload_dir) if _env_upload_dir else (BASE_DIR / "uploads")
QR_UPLOAD_DIR = UPLOAD_DIR / "qrcodes"
CROP_UPLOAD_DIR = UPLOAD_DIR / "crops"
LABEL_UPLOAD_DIR = UPLOAD_DIR / "labels"
MODELS_DIR = BASE_DIR / "models"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
QR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CROP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LABEL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

LOGO_PATH = (
    BASE_DIR / "assets" / "drishti-360-logo.jpg"
    if (BASE_DIR / "assets" / "drishti-360-logo.jpg").exists()
    else WORKSPACE_DIR / "drishti-360-logo.jpg"
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "DRISHTI 360 – AI-Powered Farm-to-Market Intelligence Platform"
    APP_ENV: str = "development"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = "postgresql+psycopg2://drishti:drishti_pass@localhost:5432/drishti360"
    SECRET_KEY: str = "drishti360-dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    FRONTEND_URL: str = "https://frontend-delta-ecru-38.vercel.app"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://frontend-delta-ecru-38.vercel.app"
    PUBLIC_VERIFY_BASE_URL: str = "http://localhost:5173/verify"
    AGMARKNET_API_KEY: str = ""
    UPLOAD_DIR: str = ""
    MAX_UPLOAD_MB: int = 10
    ENABLE_DOCS: bool = True

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        url = (value or "").strip()
        if url.startswith("postgres://"):
            return "postgresql+psycopg2://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            return "postgresql+psycopg2://" + url[len("postgresql://") :]
        return url

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.strip().lower() == "production"

    @property
    def effective_public_verify_base_url(self) -> str:
        raw = (self.PUBLIC_VERIFY_BASE_URL or "").strip().rstrip("/")
        if raw and not (self.is_production and "localhost" in raw):
            return raw
        if self.FRONTEND_URL.strip() and not (self.is_production and "localhost" in self.FRONTEND_URL):
            return f"{self.FRONTEND_URL.strip().rstrip('/')}/verify"
        return "https://frontend-delta-ecru-38.vercel.app/verify" if self.is_production else "http://localhost:5173/verify"

    @property
    def cors_origin_list(self) -> List[str]:
        origins = [
            o.strip().rstrip("/")
            for o in self.CORS_ORIGINS.split(",")
            if o.strip() and o.strip() != "*"
        ]
        for extra in (
            self.FRONTEND_URL.strip().rstrip("/"),
            "https://frontend-delta-ecru-38.vercel.app",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ):
            if extra and extra != "*" and extra not in origins:
                origins.append(extra)
        return origins


settings = Settings()
