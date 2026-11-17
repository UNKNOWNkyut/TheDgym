from datetime import datetime, timezone
from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from app.database import Base


class MemberTrainingPlan(Base):
    """Stores a member's active workout split & nutrition/meal blueprint."""

    __tablename__ = "member_training_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("members.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    updated_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    goal_focus: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    workout_plan_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    workout_split_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meal_plan_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meal_plan_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    member = relationship("Member", lazy="selectin")


class ClientProgressEntry(Base):
    """Structured trainer-logged client strength, body composition, and recovery snapshot."""

    __tablename__ = "client_progress_entries"
    __table_args__ = (
        Index("ix_client_progress_member_recorded_id", "member_id", "recorded_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recorded_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Strength & Overload
    exercise_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sets: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    training_volume: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rpe: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rir: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rest_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Body Composition (Weekly Weight & Tape Measurements in cm)
    body_weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    waist_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hips_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    arms_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    thighs_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Cardio & Recovery
    resting_heart_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    member = relationship("Member", lazy="selectin")
    recorded_by = relationship("User", foreign_keys=[recorded_by_user_id], lazy="selectin")
