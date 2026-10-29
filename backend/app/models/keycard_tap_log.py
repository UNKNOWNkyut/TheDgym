import enum
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class TapDecision(str, enum.Enum):
    GRANTED_CHECK_IN = "granted_check_in"
    GRANTED_CHECK_OUT = "granted_check_out"
    ALREADY_CHECKED_IN = "already_checked_in"
    ALREADY_CHECKED_OUT = "already_checked_out"
    PAIRED_CARD = "paired_card"
    DENIED_UNREGISTERED_CARD = "denied_unregistered_card"
    DENIED_CARD_LOST_OR_STOLEN = "denied_card_lost_or_stolen"
    DENIED_CARD_REVOKED = "denied_card_revoked"
    DENIED_MEMBER_SUSPENDED = "denied_member_suspended"
    DENIED_MEMBER_INACTIVE = "denied_member_inactive"
    DENIED_NO_MEMBERSHIP = "denied_no_membership"
    DENIED_MEMBERSHIP_EXPIRED = "denied_membership_expired"
    DENIED_PAYMENT_PENDING = "denied_payment_pending"
    DENIED_COOLDOWN_DUPLICATE = "denied_cooldown_duplicate"


class KeycardTapLog(Base):
    """Immutable audit log of every smart keycard tap (granted & denied)."""
    __tablename__ = "keycard_tap_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    keycard_id = Column(Integer, ForeignKey("member_keycards.id", ondelete="SET NULL"), nullable=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, index=True)
    scanner_id = Column(Integer, ForeignKey("access_scanners.id", ondelete="SET NULL"), nullable=True)
    visit_id = Column(Integer, ForeignKey("visits.id", ondelete="SET NULL"), nullable=True)

    card_uid_masked = Column(String(32), nullable=False)
    decision = Column(
        Enum(TapDecision, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    reason_message = Column(String(500), nullable=False)
    plan_name = Column(String(100), nullable=True)
    days_remaining = Column(Integer, nullable=True)
    warning_banner = Column(String(255), nullable=True)
    latency_ms = Column(Integer, default=0, nullable=False)

    tapped_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    member = relationship("Member", lazy="selectin")
    keycard = relationship("MemberKeycard", lazy="selectin")
    scanner = relationship("AccessScanner", lazy="selectin")

    def __repr__(self) -> str:
        return f"<KeycardTapLog(id={self.id}, decision={self.decision}, uid={self.card_uid_masked})>"
