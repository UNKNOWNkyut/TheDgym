import enum
import hashlib
import hmac
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String

from app.config import settings
from app.database import Base


class ScannerTapMode(str, enum.Enum):
    CHECK_IN_ONLY = "check_in_only"
    TOGGLE_IN_OUT = "toggle_in_out"


def hash_scanner_api_key(raw_key: str) -> str:
    """Compute HMAC-SHA256 hash of a hardware scanner API key."""
    return hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        f"dgym-scanner:{raw_key.strip()}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


class AccessScanner(Base):
    """Registered physical or virtual RFID/NFC scanner terminal."""
    __tablename__ = "access_scanners"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    location = Column(String(150), nullable=False, default="Front Desk Reception")
    api_key_hash = Column(String(64), unique=True, index=True, nullable=False)
    api_key_prefix = Column(String(16), nullable=False)

    tap_mode = Column(
        Enum(ScannerTapMode, values_callable=lambda obj: [e.value for e in obj]),
        default=ScannerTapMode.TOGGLE_IN_OUT,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    last_heartbeat_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AccessScanner(id={self.id}, name={self.name}, location={self.location})>"
