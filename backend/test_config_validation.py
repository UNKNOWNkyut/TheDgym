"""Unit tests for fail-closed environment & production config validation in app.config."""
import os
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("ENVIRONMENT", "development")

from app import config as config_mod
from app.config import _DEFAULT_DEV_SECRET, Settings, is_trusted_proxy, validate_settings
from app.core.rate_limit import resolve_client_ip

_STRONG_JWT = "x" * 64
_VALID_PROD_ENV = {
    "ENVIRONMENT": "production",
    "DATABASE_URL": "postgresql+asyncpg://dgym_user:strongpass@db:5432/dgym_prod",
    "JWT_SECRET_KEY": _STRONG_JWT,
    "CORS_ORIGINS": "https://thedgym.com, https://www.thedgym.com",
    "XENDIT_WEBHOOK_VERIFICATION_TOKEN": "wh_verif_tok_123456",
}


def _assert_fails(env: dict, expected: str, label: str) -> None:
    with patch.dict(os.environ, env, clear=True):
        cfg = Settings()
        try:
            validate_settings(cfg)
        except RuntimeError as exc:
            assert expected in str(exc), f"{label}: expected {expected!r} in {exc!s}"
            return
        raise AssertionError(f"{label}: expected RuntimeError, but validation passed")


def run_all() -> None:
    invalid_cases = [
        ({}, "missing or invalid", "unset ENVIRONMENT"),
        ({"ENVIRONMENT": "prod"}, "missing or invalid", "unknown ENVIRONMENT"),
        ({"ENVIRONMENT": "test"}, "JWT_SECRET_KEY", "test env without JWT"),
        ({"ENVIRONMENT": "staging", "JWT_SECRET_KEY": _STRONG_JWT}, "DATABASE_URL", "staging without DATABASE_URL"),
        ({**_VALID_PROD_ENV, "JWT_SECRET_KEY": _DEFAULT_DEV_SECRET}, "JWT_SECRET_KEY", "prod default JWT"),
        (
            {**_VALID_PROD_ENV, "JWT_SECRET_KEY": "REPLACE_WITH_64_CHAR_RANDOM_SECRET_IN_PRODUCTION"},
            "JWT_SECRET_KEY",
            "prod placeholder JWT",
        ),
        ({**_VALID_PROD_ENV, "DATABASE_URL": ""}, "SQLite is forbidden", "prod empty DATABASE_URL"),
        (
            {**_VALID_PROD_ENV, "DATABASE_URL": "sqlite+aiosqlite:///./dgym.db"},
            "SQLite is forbidden",
            "prod SQLite DATABASE_URL",
        ),
        ({**_VALID_PROD_ENV, "CORS_ORIGINS": ""}, "CORS_ORIGINS", "prod empty CORS_ORIGINS"),
        ({**_VALID_PROD_ENV, "CORS_ORIGINS": "https://thedgym.com,*"}, "CORS_ORIGINS", "prod wildcard CORS"),
        (
            {**_VALID_PROD_ENV, "XENDIT_WEBHOOK_VERIFICATION_TOKEN": ""},
            "XENDIT_WEBHOOK_VERIFICATION_TOKEN",
            "prod missing webhook token",
        ),
    ]
    for env, expected, label in invalid_cases:
        _assert_fails(env, expected, label)

    with patch.dict(os.environ, {"ENVIRONMENT": "development"}, clear=True):
        dev_cfg = Settings()
        validate_settings(dev_cfg)
        assert dev_cfg.JWT_SECRET_KEY == _DEFAULT_DEV_SECRET
        assert "sqlite" in dev_cfg.DATABASE_URL
        assert "http://localhost:5173" in dev_cfg.CORS_ORIGINS

    with patch.dict(os.environ, _VALID_PROD_ENV, clear=True):
        prod_cfg = Settings()
        validate_settings(prod_cfg)
        assert prod_cfg.CORS_ORIGINS == ["https://thedgym.com", "https://www.thedgym.com"]

    with patch.dict(
        os.environ,
        {**_VALID_PROD_ENV, "TRUSTED_PROXY_IPS": "127.0.0.1,172.16.0.0/12,not-an-ip"},
        clear=True,
    ):
        proxy_cfg = Settings()
        assert is_trusted_proxy("127.0.0.1", proxy_cfg)
        assert is_trusted_proxy("172.18.0.5", proxy_cfg)
        assert not is_trusted_proxy("203.0.113.50", proxy_cfg)

        with patch.object(config_mod, "settings", proxy_cfg):
            spoofed_req = SimpleNamespace(
                client=SimpleNamespace(host="203.0.113.50"),
                headers={"x-forwarded-for": "1.1.1.1, 8.8.8.8"},
            )
            assert resolve_client_ip(spoofed_req) == "203.0.113.50"

            proxied_req = SimpleNamespace(
                client=SimpleNamespace(host="172.18.0.5"),
                headers={"x-forwarded-for": "9.9.9.9, 198.51.100.77"},
            )
            assert resolve_client_ip(proxied_req) == "198.51.100.77"

    print(f"[PASS] All {len(invalid_cases) + 3} config & proxy validation checks passed")


if __name__ == "__main__":
    run_all()
