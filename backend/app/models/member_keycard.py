import enum
import hashlib
import hmac
import re
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.config import settings
from app.database import Base

_UID_CLEAN_RE = re.compile(r"[^A-F0-9]")


class KeycardStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    LOST = "lost"
    STOLEN = "stolen"
    REVOKED = "revoked"


def normalize_card_uid(raw_uid: str) -> str:
    """
    Normalize a raw RFID/NFC UID read from USB Keyboard-Wedge or PC/SC reader.
    Strips colons, dashes, spaces, and control characters, returning uppercase alphanumeric.
    """
    cleaned = raw_uid.strip().upper()
    # Allow alphanumeric simulator/card tokens while stripping delimiters like ':' or '-'
    alnum = re.sub(r"[^A-Z0-9]", "", cleaned)
    return alnum


def hash_card_uid(raw_uid: str) -> str:
    """
    Compute deterministic HMAC-SHA256 hash of normalized card UID using server secret pepper.
    Prevents plaintext card UID leakage if database backups are ever exposed.
    """
    norm = normalize_card_uid(raw_uid)
    return hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        f"dgym-keycard:{norm}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def mask_card_uid(raw_uid: str) -> str:
    """Return display-safe masked UID, e.g. '****E580'."""
    norm = normalize_card_uid(raw_uid)
    if len(norm) <= 4:
        return f"****{norm}"
    return f"****{norm[-4:]}"


class MemberKeycard(Base):
    """Smart RFID/NFC keycard issued to a gym member (1:N history supported)."""
    __tablename__ = "member_keycards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)

    card_uid_hash = Column(String(64), unique=True, index=True, nullable=False)
    card_uid_masked = Column(String(32), nullable=False)
    card_label = Column(String(100), nullable=False, default="Primary PVC Keycard")

    status = Column(
        Enum(KeycardStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=KeycardStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    issued_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    issued_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_reason = Column(Text, nullable=True)
    last_tapped_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    member = relationship("Member", back_populates="keycards")
    issued_by = relationship("User", foreign_keys=[issued_by_user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<MemberKeycard(id={self.id}, member_id={self.member_id}, uid={self.card_uid_masked}, status={self.status})>"
