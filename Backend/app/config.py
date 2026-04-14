# app/config.py
"""
Central configuration for Crime Tracer Mangalore.

Uses pydantic-settings (Pydantic v2 compatible) to read from environment variables
and .env file.

All other modules should import `settings` from here.
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional, List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from Backend directory so CORS/origins load correctly regardless of cwd
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # ----- App basics -----
    APP_NAME: str = "Crime Tracer Mangalore"
    ENV: str = "local"  # local | dev | prod

    # JWT / auth
    # ⚠️ Make sure to override this in your .env:
    # SECRET_KEY="your_long_random_secret_here"
    SECRET_KEY: str = "change-this-in-.env"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # Short-lived access tokens (default 15 minutes)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # Long-lived refresh tokens (default 7 days)

    # Database
    SQLALCHEMY_DATABASE_URL: str = "sqlite:///./crime_tracer.db"
    
    # Firebase Firestore (Primary Production Database)
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_DATABASE_URL: Optional[str] = None

    # CORS
    # In .env, you can set as:
    # ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
    ALLOWED_ORIGINS_RAW: Optional[str] = None

    # File uploads
    UPLOAD_DIR: str = "uploads"

    # AWS / S3 (optional; if not set, storage falls back to LOCAL)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None

    # Grok / LLM
    GROK_API_KEY: Optional[str] = None
    GROK_MODEL: str = "grok-2-latest"
    
    # Model Service (Local BNS)
    MODEL_SERVICE_URL: str = "http://localhost:8001/predict"
    # Prefer Groq for BNS so suggestions match the complaint (e.g. no dowry/rape for scam/promise-to-marry)
    PREFER_GROQ_BNS: bool = True

    # Admin bootstrap (optional – can seed manually too)
    ADMIN_DEFAULT_USERNAME: str = "admin"
    ADMIN_DEFAULT_PASSWORD: str = "admin123"
    
    # Blockchain Configuration (for secure audit trail)
    BLOCKCHAIN_ENABLED: bool = True
    BLOCKCHAIN_NETWORK: str = "local"  # local, ethereum, polygon
    ETHEREUM_RPC_URL: Optional[str] = None
    ETHEREUM_PRIVATE_KEY: Optional[str] = None
    ETHEREUM_CONTRACT_ADDRESS: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> List[str]:
        """
        Returns a list of CORS origins.

        - If ALLOWED_ORIGINS_RAW is empty/None -> ["*"] in prod, or common dev origins in local/dev.
        - In local/dev, always includes localhost:4173 and 5173 so dashboard and Vite work.
        """
        _dev_origins = [
            "http://localhost:5173",
            "http://localhost:4173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:4173",
        ]
        if not self.ALLOWED_ORIGINS_RAW or self.ALLOWED_ORIGINS_RAW.strip() == "":
            return _dev_origins if self.ENV in ("local", "dev") else ["*"]
        parts = [p.strip() for p in self.ALLOWED_ORIGINS_RAW.split(",")]
        origins = [p for p in parts if p] or ["*"]
        # In local/dev ensure dev origins are included (fixes CORS when .env was wrong or cwd differed)
        if origins != ["*"] and self.ENV in ("local", "dev"):
            for o in _dev_origins:
                if o not in origins:
                    origins.append(o)
        return origins


@lru_cache
def get_settings() -> Settings:
    # lru_cache so we only instantiate once
    return Settings()


settings = get_settings()
