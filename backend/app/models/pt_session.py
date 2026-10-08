import enum
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.database import Base


class PTSessionStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SCHEDULED = "scheduled"
    REJECTED = "rejected"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class PTSession(Base):
    """A one-on-one Personal Training session between a Trainer and a Member."""
    __tablename__ = "pt_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    trainer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)

    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes = Column(Integer, default=60, nullable=False)

    status = Column(
        Enum(PTSessionStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=PTSessionStatus.SCHEDULED,
        nullable=False,
    )

    notes = Column(Text, nullable=True)
    # Private coach-only notes
    coach_notes = Column(Text, nullable=True)
    # Reason if rejected
    rejection_reason = Column(Text, nullable=True)

    # Timestamps
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
    trainer = relationship("User", foreign_keys=[trainer_id], lazy="selectin")
    member = relationship("Member", back_populates="pt_sessions", lazy="selectin")

    def __repr__(self) -> str:
        return f"<PTSession(id={self.id}, trainer={self.trainer_id}, member={self.member_id}, at={self.scheduled_at})>"
