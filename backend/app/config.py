import ipaddress
import logging
import os
from pathlib import Path
from typing import List, Optional, Set, Tuple, Union

ProxyNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]

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

_ALLOWED_ENVIRONMENTS = {"development", "test", "staging", "production"}
_DEFAULT_DEV_SECRET = "dgym-ultra-secure-jwt-secret-key-rosario-batangas-2026-32chars"
_UNSAFE_JWT_SECRETS = {
    "",
    _DEFAULT_DEV_SECRET,
    "REPLACE_WITH_64_CHAR_RANDOM_SECRET_IN_PRODUCTION",
}
_DEV_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]


def _split_csv(raw: str) -> List[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def _parse_proxy_networks(entries: Set[str]) -> Tuple[ProxyNetwork, ...]:
    networks: List[ProxyNetwork] = []
    for entry in entries:
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            logger.warning("Ignoring invalid TRUSTED_PROXY_IPS entry: %r", entry)
    return tuple(networks)


class Settings:
    PROJECT_NAME: str = "The DGym API"
    VERSION: str = "1.0.0"

    def __init__(self) -> None:
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "").lower().strip()

        # Database: defaults to async SQLite only for local development/testing
        raw_db_url = os.getenv("DATABASE_URL", "").strip()
        self.DATABASE_URL: str = raw_db_url or (
            f"sqlite+aiosqlite:///{base_dir / 'dgym.db'}"
            if self.ENVIRONMENT in ("development", "test")
            else ""
        )

        # JWT Settings (Check 25 & 26)
        raw_jwt = os.getenv("JWT_SECRET_KEY", "").strip()
        self.JWT_SECRET_KEY: str = raw_jwt or (
            _DEFAULT_DEV_SECRET if self.ENVIRONMENT == "development" else ""
        )
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

        # Trusted reverse-proxy IPs or CIDRs permitted to supply X-Forwarded-For (`ANTIGRAV-05`)
        self.TRUSTED_PROXY_IPS: Set[str] = set(
            _split_csv(os.getenv("TRUSTED_PROXY_IPS", "127.0.0.1,::1"))
        )
        self.TRUSTED_PROXY_NETWORKS: Tuple[ProxyNetwork, ...] = _parse_proxy_networks(
            self.TRUSTED_PROXY_IPS
        )

        # Google OAuth Settings
        self.GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
        self.GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

        # Xendit Payment Gateway Verification
        self.XENDIT_WEBHOOK_VERIFICATION_TOKEN: str = os.getenv(
            "XENDIT_WEBHOOK_VERIFICATION_TOKEN", ""
        ).strip()

        # CORS (Check 27): fallback to localhost only in development/testing
        env_origins = _split_csv(os.getenv("CORS_ORIGINS", ""))
        self.CORS_ORIGINS: List[str] = env_origins or (
            list(_DEV_CORS_ORIGINS) if self.ENVIRONMENT in ("development", "test") else []
        )


def validate_settings(cfg: Settings) -> None:
    if cfg.ENVIRONMENT not in _ALLOWED_ENVIRONMENTS:
        allowed = ", ".join(sorted(_ALLOWED_ENVIRONMENTS))
        raise RuntimeError(
            f"[ANTIGRAV-01] ENVIRONMENT='{cfg.ENVIRONMENT}' is missing or invalid. "
            f"Set ENVIRONMENT explicitly to one of: {allowed}."
        )

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

    if cfg.ENVIRONMENT == "staging" and not cfg.DATABASE_URL:
        raise RuntimeError(
            "[ANTIGRAV-01] Refusing to start in ENVIRONMENT='staging' without DATABASE_URL."
        )

    if cfg.ENVIRONMENT == "production":
        errors: List[str] = []
        if not cfg.DATABASE_URL or cfg.DATABASE_URL.lower().startswith("sqlite"):
            errors.append("DATABASE_URL must be configured for PostgreSQL (SQLite is forbidden)")
        if not cfg.CORS_ORIGINS or "*" in cfg.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must specify explicit allowed origins without '*'")
        if not cfg.XENDIT_WEBHOOK_VERIFICATION_TOKEN:
            errors.append("XENDIT_WEBHOOK_VERIFICATION_TOKEN must be configured")
        if errors:
            raise RuntimeError(
                "[ANTIGRAV-01] Refusing to start in ENVIRONMENT='production': "
                + "; ".join(errors)
                + "."
            )


def is_trusted_proxy(ip_str: str, cfg: Optional[Settings] = None) -> bool:
    """Return True if *ip_str* matches a configured trusted proxy IP or CIDR subnet."""
    resolved_cfg = cfg or settings
    if ip_str in resolved_cfg.TRUSTED_PROXY_IPS:
        return True
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return any(addr in network for network in resolved_cfg.TRUSTED_PROXY_NETWORKS)


settings = Settings()
validate_settings(settings)
