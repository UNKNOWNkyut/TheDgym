import enum
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class MembershipStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    GCASH = "gcash"
    MAYA = "maya"
    BANK_TRANSFER = "bank_transfer"
    OTHER = "other"


class MemberMembership(Base):
    """Junction table: links a Member to a MembershipPlan for a specific period."""
    __tablename__ = "member_memberships"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # FK references
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("membership_plans.id", ondelete="RESTRICT"), nullable=False, index=True)

    # Period
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)

    # Status
    status = Column(
        Enum(MembershipStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=MembershipStatus.ACTIVE,
        nullable=False,
    )

    # Payment tracking (manual entry for now — will integrate real payment gateway later)
    paid_amount = Column(Numeric(10, 2), nullable=True)
    payment_method = Column(
        Enum(PaymentMethod, values_callable=lambda obj: [e.value for e in obj]),
        default=PaymentMethod.CASH,
        nullable=True,
    )
    payment_reference = Column(String(100), nullable=True)  # GCash ref, receipt no., etc.

    # Staff who created/assigned this membership
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Notes
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

    # Relationships with eager selectin loading for async operations
    member = relationship("Member", back_populates="memberships")
    plan = relationship("MembershipPlan", lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<MemberMembership(id={self.id}, member_id={self.member_id}, plan_id={self.plan_id}, status={self.status})>"
