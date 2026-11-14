from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

# Initialize Argon2id password hasher
ph = PasswordHasher()

# Pre-computed dummy hash for constant-time login checks when email does not exist (Check 56)
_DUMMY_ARGON2_HASH = ph.hash("dgym-constant-time-dummy-password-guard")

# Server-side token revocation L1 cache backed by DB persistence (`revoked_tokens` + `users.tokens_valid_after`)
_MAX_REVOKED_JTIS = 10_000
_MAX_USER_REVOCATIONS = 10_000
_REVOKED_JTIS: OrderedDict[str, float] = OrderedDict()
_USER_MIN_IAT: OrderedDict[str, float] = OrderedDict()


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """
    Verify a plain password against an Argon2 hash in constant time.
    If hashed_password is None (user not found), verifies against a dummy hash
    to prevent timing-based account enumeration (Check 56).
    """
    target_hash = hashed_password if hashed_password else _DUMMY_ARGON2_HASH
    try:
        matched = ph.verify(target_hash, plain_password)
        return matched if hashed_password else False
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create a signed JWT access token with jti, iss, aud, iat, and exp (Check 25 & 26)."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update(
        {
            "jti": uuid4().hex,
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "iat": now.timestamp(),
            "exp": expire.timestamp(),
        }
    )
    return jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def revoke_token(token: Optional[str]) -> None:
    """Revoke a specific JWT token on logout (Check 25 & ANTIGRAV-09 FIFO eviction)."""
    if not token:
        return
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
        )
        jti = payload.get("jti")
        if not jti:
            return

        jti_str = str(jti)
        now_ts = datetime.now(timezone.utc).timestamp()
        exp_ts = float(payload.get("exp", now_ts))

        _REVOKED_JTIS.pop(jti_str, None)
        _REVOKED_JTIS[jti_str] = exp_ts

        # Prune naturally expired entries from the front first, then FIFO-evict oldest if over cap
        while _REVOKED_JTIS:
            oldest_jti, oldest_exp = next(iter(_REVOKED_JTIS.items()))
            if oldest_exp <= now_ts or len(_REVOKED_JTIS) > _MAX_REVOKED_JTIS:
                _REVOKED_JTIS.pop(oldest_jti, None)
            else:
                break
    except jwt.PyJWTError:
        pass


def revoke_user_sessions(user_id: int) -> None:
    """Invalidate all tokens issued for user_id prior to right now (Check 25)."""
    sub = str(user_id)
    _USER_MIN_IAT.pop(sub, None)
    _USER_MIN_IAT[sub] = datetime.now(timezone.utc).timestamp()
    while len(_USER_MIN_IAT) > _MAX_USER_REVOCATIONS:
        _USER_MIN_IAT.popitem(last=False)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT access token including revocation and claims (Check 25, 26 & ANTIGRAV-09)."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={"require": ["exp", "iat", "sub", "jti", "iss", "aud"]},
        )

        # Prevent pre-auth 2FA challenge tokens from bypassing full authentication
        if payload.get("token_use") == "face_2fa":
            return None

        # Check JTI revocation list (Check 25)
        jti = str(payload.get("jti", "")).strip()
        if not jti or jti in _REVOKED_JTIS:
            return None

        # Check user-wide session invalidation timestamp
        sub = str(payload.get("sub", ""))
        iat = payload.get("iat")
        if sub in _USER_MIN_IAT and float(iat) < _USER_MIN_IAT[sub]:
            return None

        return payload
    except (jwt.PyJWTError, TypeError, ValueError):
        return None


def create_face_challenge_token(
    user_id: int,
    purpose: str,
    expires_minutes: int = 5,
) -> str:
    """Create a short-lived pre-auth token used exclusively for Step 2 face verify/enroll."""
    return create_access_token(
        {
            "sub": str(user_id),
            "purpose": purpose,
            "token_use": "face_2fa",
        },
        expires_delta=timedelta(minutes=expires_minutes),
    )


def decode_face_challenge_token(
    token: str,
    expected_purpose: str,
) -> Optional[Dict[str, Any]]:
    """Decode and validate a single-purpose Step 2 face challenge token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={"require": ["exp", "iat", "sub", "jti", "iss", "aud"]},
        )
        if payload.get("token_use") != "face_2fa":
            return None
        if payload.get("purpose") != expected_purpose:
            return None

        jti = str(payload.get("jti", "")).strip()
        if not jti or jti in _REVOKED_JTIS:
            return None

        sub = str(payload.get("sub", ""))
        iat = payload.get("iat")
        if sub in _USER_MIN_IAT and float(iat) < _USER_MIN_IAT[sub]:
            return None

        return payload
    except (jwt.PyJWTError, TypeError, ValueError):
        return None


async def persist_revoked_token(db: AsyncSession, token: Optional[str]) -> None:
    """Persist explicit JTI revocation in DB so logouts and single-use challenges survive restarts."""
    if not token:
        return
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
        )
    except jwt.PyJWTError:
        return

    jti = str(payload.get("jti", "")).strip()
    if not jti:
        return

    revoke_token(token)
    now = datetime.now(timezone.utc)
    exp_ts = float(payload.get("exp", now.timestamp()))
    expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc)

    from app.models.revoked_token import RevokedToken

    await db.execute(delete(RevokedToken).where(RevokedToken.expires_at <= now))
    existing = await db.get(RevokedToken, jti)
    if existing is None:
        db.add(RevokedToken(jti=jti, expires_at=expires_at, revoked_at=now))
    await db.flush()


async def persist_user_session_revocation(db: AsyncSession, user_id: int) -> None:
    """Persist user-wide cutoff timestamp in DB so password/role/status revocations survive restarts."""
    revoke_user_sessions(user_id)
    now = datetime.now(timezone.utc)
    from app.models.user import User

    await db.execute(
        update(User).where(User.id == user_id).values(tokens_valid_after=now)
    )
    await db.flush()


async def is_session_revoked_in_db(
    db: AsyncSession,
    payload: Dict[str, Any],
    user: Optional[Any] = None,
) -> bool:
    """Verify JWT has not been revoked in persistent storage after container/process restart."""
    from app.models.revoked_token import RevokedToken

    jti = str(payload.get("jti", "")).strip()
    if not jti:
        return True

    revoked_row = (
        await db.execute(select(RevokedToken.jti).where(RevokedToken.jti == jti).limit(1))
    ).scalar_one_or_none()
    if revoked_row is not None:
        return True

    valid_after = getattr(user, "tokens_valid_after", None) if user is not None else None
    if valid_after is not None:
        try:
            iat = float(payload.get("iat", 0))
            if iat < _as_utc(valid_after).timestamp():
                return True
        except (TypeError, ValueError):
            return True

    return False
