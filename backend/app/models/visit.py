import enum
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.database import Base


class VisitType(str, enum.Enum):
    WALK_IN = "walk_in"
    CLASS = "class"
    PT_SESSION = "pt_session"
    OPEN_GYM = "open_gym"


class Visit(Base):
    """Records a member gym visit / check-in event."""
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Timing
    checked_in_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    checked_out_at = Column(DateTime(timezone=True), nullable=True)

    # Visit classification
    visit_type = Column(
        Enum(VisitType, values_callable=lambda obj: [e.value for e in obj]),
        default=VisitType.WALK_IN,
        nullable=False,
    )

    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    member = relationship("Member", back_populates="visits", lazy="selectin")
    recorded_by = relationship("User", foreign_keys=[recorded_by_user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<Visit(id={self.id}, member_id={self.member_id}, type={self.visit_type}, in={self.checked_in_at})>"
