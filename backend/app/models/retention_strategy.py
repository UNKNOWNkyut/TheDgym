from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class RetentionStrategy(Base):
    __tablename__ = "retention_strategies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    risk_tier = Column(String(20), nullable=False, index=True)  # HIGH, MEDIUM, LOW
    churn_probability = Column(Float, nullable=False, default=0.0)
    urgency = Column(String(20), nullable=False, default="HIGH")  # CRITICAL, HIGH, MODERATE
    strategy_title = Column(String(200), nullable=False)
    diagnosis_summary = Column(Text, nullable=False)
    tactical_action_steps = Column(Text, nullable=False)  # JSON-encoded array of strings
    offer_title = Column(String(150), nullable=False)
    offer_message = Column(Text, nullable=False)
    offer_action_text = Column(String(100), nullable=False, default="Claim Offer")
    offer_action_url = Column(String(200), nullable=False, default="/membership")
    status = Column(String(20), nullable=False, default="generated")  # generated, dispatched, completed
    dispatched_at = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    member = relationship("Member", backref="retention_strategies")
