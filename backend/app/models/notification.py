from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Boolean,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False, default="announcement")  # retention, offer, booking, announcement
    action_text = Column(String(100), nullable=True)
    action_url = Column(String(250), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", backref="notifications")
    member = relationship("Member", backref="notifications")
