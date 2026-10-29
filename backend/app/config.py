import logging
import os
from pathlib import Path
from typing import List

logger = logging.getLogger("dgym.security")

try:
    from dotenv import load_dotenv

    # Search for .env file in cwd, backend directory, or root directory
    base_dir = Path(__file__).resolve().parent.parent
    for p in [Path(".env"), base_dir / ".env", base_dir.parent / ".env"]:
        if p.is_file():
            load_dotenv(dotenv_path=p, override=False)
            break
except ImportError:
    base_dir = Path(__file__).resolve().parent.parent

_DEFAULT_DEV_SECRET = "dgym-ultra-secure-jwt-secret-key-rosario-batangas-2026-32chars"


class Settings:
    PROJECT_NAME: str = "The DGym API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower().strip()

    # Database: defaults to async SQLite for local standalone development,
    # or PostgreSQL (e.g. postgresql+asyncpg://user:pass@localhost:5432/dgym)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", f"sqlite+aiosqlite:///{base_dir / 'dgym.db'}"
    )

    # JWT Settings (Check 25 & 26)
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", _DEFAULT_DEV_SECRET)
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = os.getenv("JWT_ISSUER", "thedgym-api")
    JWT_AUDIENCE: str = os.getenv("JWT_AUDIENCE", "thedgym-client")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours

    # Request Resource Ceiling (Check 64)
    MAX_REQUEST_BODY_BYTES: int = int(os.getenv("MAX_REQUEST_BODY_BYTES", str(6 * 1024 * 1024)))

    # Google OAuth Settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # CORS (Check 27)
    _env_origins: str = os.getenv("CORS_ORIGINS", "")
    CORS_ORIGINS: List[str] = (
        [o.strip() for o in _env_origins.split(",") if o.strip()]
        if _env_origins
        else [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ]
    )


settings = Settings()

if settings.ENVIRONMENT == "production":
    if settings.JWT_SECRET_KEY == _DEFAULT_DEV_SECRET or len(settings.JWT_SECRET_KEY) < 32:
        logger.critical(
            "[SECURITY WARNING] Production environment detected with default or short JWT_SECRET_KEY! "
            "Set a strong 64-character random JWT_SECRET_KEY in your production environment variables."
        )
