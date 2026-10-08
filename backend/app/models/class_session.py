import enum
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ClassType(str, enum.Enum):
    BARBELL_CLUB = "barbell_club"
    CONDITIONING = "conditioning"
    OPEN_GYM = "open_gym"
    POWERLIFTING = "powerlifting"
    STRENGTH = "strength"
    HIIT = "hiit"
    OTHER = "other"


class ClassStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ClassSession(Base):
    """A scheduled group class or training session."""
    __tablename__ = "class_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    # Coach (trainer user) who runs this class
    coach_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    class_type = Column(
        Enum(ClassType, values_callable=lambda obj: [e.value for e in obj]),
        default=ClassType.OPEN_GYM,
        nullable=False,
    )

    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes = Column(Integer, default=60, nullable=False)
    max_capacity = Column(Integer, default=20, nullable=False)

    status = Column(
        Enum(ClassStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=ClassStatus.SCHEDULED,
        nullable=False,
    )

    location = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

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
    coach = relationship("User", foreign_keys=[coach_id], lazy="selectin")
    enrollments = relationship("ClassEnrollment", back_populates="class_session", lazy="selectin", cascade="all, delete-orphan")

    @property
    def enrolled_count(self) -> int:
        return len(self.enrollments)

    def __repr__(self) -> str:
        return f"<ClassSession(id={self.id}, name={self.name}, at={self.scheduled_at})>"


class ClassEnrollment(Base):
    """Junction: links a Member to a ClassSession enrollment."""
    __tablename__ = "class_enrollments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    class_session_id = Column(Integer, ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    enrolled_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    notes = Column(Text, nullable=True)

    # Relationships
    member = relationship("Member", back_populates="class_enrollments", lazy="selectin")
    class_session = relationship("ClassSession", back_populates="enrollments")

    def __repr__(self) -> str:
        return f"<ClassEnrollment(id={self.id}, member_id={self.member_id}, session_id={self.class_session_id})>"
