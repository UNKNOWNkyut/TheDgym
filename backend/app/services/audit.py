import logging
import re
from typing import Optional
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import resolve_client_ip
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.pagination import read_page_cache

logger = logging.getLogger("dgym.security")

# Patterns for redacting secrets/tokens/passwords from log strings (Check 35)
_REDACT_PATTERNS = [
    (re.compile(r"(password|passwd|pwd|secret|token|authorization|api_key|credential)\s*[:=]\s*['\"]?[^'\",\s}]+['\"]?", re.IGNORECASE), r"\1=[REDACTED]"),
    (re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE), "Bearer [REDACTED]"),
]


def redact_sensitive_text(text: Optional[str]) -> Optional[str]:
    """Redact passwords, tokens, and API keys from log strings (Check 35)."""
    if not text:
        return text
    sanitized = str(text)
    for pattern, replacement in _REDACT_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized[:1000]


def get_client_ip(request: Optional[Request]) -> str:
    """Safely extract client IP address respecting reverse proxy headers."""
    return resolve_client_ip(request, default="unknown")


def get_user_agent(request: Optional[Request]) -> Optional[str]:
    """Extract compact sanitized User-Agent header from request."""
    if not request:
        return None
    raw = (request.headers.get("user-agent") or "").strip()
    if not raw:
        return None
    return redact_sensitive_text(raw)[:255]


def _resolve_actor_role(actor: Optional[User], actor_role: Optional[str]) -> Optional[str]:
    if actor is not None:
        return actor.role.value if hasattr(actor.role, "value") else str(actor.role)
    return actor_role


async def record_audit_log(
    db: AsyncSession,
    *,
    action: str,
    actor: Optional[User] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    outcome: str = "SUCCESS",
    details: Optional[str] = None,
    request: Optional[Request] = None,
    commit: bool = False,
) -> None:
    """
    Record an immutable security audit event (Check 42 & 43).
    Never raises an exception to the caller if logging fails.
    """
    try:
        ip_addr = get_client_ip(request)
        user_agent = get_user_agent(request)
        resolved_user_id = actor.id if actor else None
        resolved_email = actor.email if actor else actor_email
        resolved_role = _resolve_actor_role(actor, actor_role)
        safe_details = redact_sensitive_text(details)

        entry = AuditLog(
            actor_user_id=resolved_user_id,
            actor_email=resolved_email,
            actor_role=resolved_role,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            ip_address=ip_addr,
            user_agent=user_agent,
            outcome=outcome,
            details=safe_details,
        )
        db.add(entry)
        if commit:
            await db.commit()
        read_page_cache.invalidate_prefix("audit_logs:")

        log_msg = (
            f"[AUDIT] action={action} outcome={outcome} "
            f"actor={resolved_email or 'anonymous'} role={resolved_role or '-'} ip={ip_addr} "
            f"target={target_type}:{target_id} details={safe_details or '-'}"
        )
        if outcome != "SUCCESS":
            logger.warning(log_msg)
        else:
            logger.info(log_msg)
    except Exception as exc:
        logger.error(f"Failed to write audit log: {exc}")
