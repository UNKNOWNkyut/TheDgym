from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class PairingSession(Base):
    """Persistent Smart Pairing Mode session shared across restarts and tabs."""

    __tablename__ = "pairing_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_code = Column(String(64), nullable=False)
    member_name = Column(String(255), nullable=False)
    card_label = Column(String(100), nullable=False, default="NFC Smart Keycard")
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    member = relationship("Member", lazy="selectin")
    creator = relationship("User", foreign_keys=[created_by], lazy="selectin")
