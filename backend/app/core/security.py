from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import settings

# Initialize Argon2id password hasher
ph = PasswordHasher()

# Pre-computed dummy hash for constant-time login checks when email does not exist (Check 56)
_DUMMY_ARGON2_HASH = ph.hash("dgym-constant-time-dummy-password-guard")

# Server-side token revocation store (Check 25: Session invalidation on logout / password change)
# shortcut: in-memory revocation resets on process restart, move to shared DB/Redis if running >1 worker
_MAX_REVOKED_JTIS = 10_000
_MAX_USER_REVOCATIONS = 10_000
_REVOKED_JTIS: OrderedDict[str, float] = OrderedDict()
_USER_MIN_IAT: OrderedDict[str, float] = OrderedDict()


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
