from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    profile_picture_path = Column(
        String(500),
        nullable=True,
    )

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

    user = relationship(
        "User",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<UserProfile("
            f"id={self.id}, "
            f"user_id={self.user_id}"
            f")>"
        )