import logging
import os
from pathlib import Path
from typing import List, Set

logger = logging.getLogger("dgym.security")

base_dir = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv

    # Search for .env file in cwd, backend directory, or root directory
    for p in (Path(".env"), base_dir / ".env", base_dir.parent / ".env"):
        if p.is_file():
            load_dotenv(dotenv_path=p, override=False)
            break
except ImportError:
    pass

_DEFAULT_DEV_SECRET = "dgym-ultra-secure-jwt-secret-key-rosario-batangas-2026-32chars"
_UNSAFE_JWT_SECRETS = {
    "",
    _DEFAULT_DEV_SECRET,
    "REPLACE_WITH_64_CHAR_RANDOM_SECRET_IN_PRODUCTION",
}


def _split_csv(raw: str) -> List[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    PROJECT_NAME: str = "The DGym API"
    VERSION: str = "1.0.0"

    def __init__(self) -> None:
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower().strip()

        # Database: defaults to async SQLite for local standalone development,
        self.DATABASE_URL: str = os.getenv(
            "DATABASE_URL", f"sqlite+aiosqlite:///{base_dir / 'dgym.db'}"
        )

        # JWT Settings (Check 25 & 26)
        self.JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", _DEFAULT_DEV_SECRET).strip()
        self.JWT_ALGORITHM: str = "HS256"
        self.JWT_ISSUER: str = os.getenv("JWT_ISSUER", "thedgym-api")
        self.JWT_AUDIENCE: str = os.getenv("JWT_AUDIENCE", "thedgym-client")
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
        )  # 24 hours

        # Request Resource Ceiling (Check 64)
        self.MAX_REQUEST_BODY_BYTES: int = int(
            os.getenv("MAX_REQUEST_BODY_BYTES", str(6 * 1024 * 1024))
        )

        # Trusted reverse-proxy IPs permitted to supply X-Forwarded-For (`ANTIGRAV-05`)
        self.TRUSTED_PROXY_IPS: Set[str] = set(
            _split_csv(os.getenv("TRUSTED_PROXY_IPS", "127.0.0.1,::1"))
        )

        # Google OAuth Settings
        self.GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
        self.GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

        # CORS (Check 27)
        env_origins = _split_csv(os.getenv("CORS_ORIGINS", ""))
        self.CORS_ORIGINS: List[str] = env_origins or [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ]


def validate_settings(cfg: Settings) -> None:
    is_weak = cfg.JWT_SECRET_KEY in _UNSAFE_JWT_SECRETS or len(cfg.JWT_SECRET_KEY) < 32
    if cfg.ENVIRONMENT != "development" and is_weak:
        raise RuntimeError(
            f"[ANTIGRAV-01] Refusing to start in ENVIRONMENT='{cfg.ENVIRONMENT}' with a default, "
            "placeholder, or <32-character JWT_SECRET_KEY. Configure a strong random JWT_SECRET_KEY."
        )
    if is_weak:
        logger.warning(
            "Using fallback development JWT_SECRET_KEY; set JWT_SECRET_KEY in backend/.env."
        )


settings = Settings()
validate_settings(settings)
