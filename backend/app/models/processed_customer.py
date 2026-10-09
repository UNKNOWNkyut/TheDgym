from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Float,
    DateTime,
    Numeric,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ProcessedCustomer(Base):
    __tablename__ = "processed_customers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    visit_frequency_weekly = Column(Float, nullable=False, default=0.0)
    days_since_last_checkin = Column(Integer, nullable=False, default=0)
    total_visits_30d = Column(Integer, nullable=False, default=0)
    total_class_bookings = Column(Integer, nullable=False, default=0)
    total_pt_sessions = Column(Integer, nullable=False, default=0)
    membership_tenure_days = Column(Integer, nullable=False, default=0)
    total_revenue_lifetime = Column(Numeric(12, 2), nullable=False, default=0.00)
    recent_activity_score = Column(Float, nullable=False, default=0.0)
    feature_calculated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    member = relationship("Member", backref="processed_features")
