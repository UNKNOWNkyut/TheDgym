from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text

from app.database import Base


class MembershipPlan(Base):
    __tablename__ = "membership_plans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Plan identity
    name = Column(String(100), unique=True, nullable=False)  # e.g. "Monthly", "Day Pass", "Student"
    slug = Column(String(100), unique=True, nullable=False)  # e.g. "monthly", "day-pass"
    description = Column(Text, nullable=True)

    # Duration in days (e.g. 1 = day pass, 30 = monthly, 90 = quarterly, 365 = annual)
    duration_days = Column(Integer, nullable=False)

    # Pricing in PHP (placeholder — replace with real data from company)
    price_php = Column(Numeric(10, 2), nullable=False)

    # Whether this plan is publicly available
    is_active = Column(Boolean, default=True, nullable=False)

    # Sort order for display
    sort_order = Column(Integer, default=0, nullable=False)

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

    def __repr__(self) -> str:
        return f"<MembershipPlan(id={self.id}, name={self.name}, price_php={self.price_php})>"
