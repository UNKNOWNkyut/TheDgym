from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Set
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
_REVOKED_JTIS: Set[str] = set()
_USER_MIN_IAT: Dict[str, float] = {}


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
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update(
        {
            "jti": uuid4().hex,
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "iat": now,
            "exp": expire,
        }
    )
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def revoke_token(token: Optional[str]) -> None:
    """Revoke a specific JWT token on logout (Check 25)."""
    if not token:
        return
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False, "verify_iss": False},
        )
        jti = payload.get("jti")
        if jti:
            if len(_REVOKED_JTIS) > 10000:
                _REVOKED_JTIS.clear()
            _REVOKED_JTIS.add(str(jti))
    except jwt.PyJWTError:
        pass


def revoke_user_sessions(user_id: int) -> None:
    """Invalidate all tokens issued for user_id prior to right now (Check 25)."""
    _USER_MIN_IAT[str(user_id)] = datetime.now(timezone.utc).timestamp()


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT access token including revocation and claims (Check 25 & 26)."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub"], "verify_aud": False, "verify_iss": False},
        )

        # Verify issuer and audience if present on token
        tok_iss = payload.get("iss")
        if tok_iss and tok_iss != settings.JWT_ISSUER:
            return None

        tok_aud = payload.get("aud")
        if tok_aud and tok_aud != settings.JWT_AUDIENCE:
            return None

        # Check JTI revocation list (Check 25)
        jti = payload.get("jti")
        if jti and str(jti) in _REVOKED_JTIS:
            return None

        # Check user-wide session invalidation timestamp
        sub = str(payload.get("sub", ""))
        iat = payload.get("iat")
        if sub in _USER_MIN_IAT and iat is not None:
            if float(iat) < _USER_MIN_IAT[sub] - 1.0:
                return None

        return payload
    except jwt.PyJWTError:
        return None
