from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Numeric,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class RawTransaction(Base):
    __tablename__ = "raw_transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transaction_type = Column(String(50), nullable=False)  # visit, payment, class_booking, pt_session
    transaction_date = Column(DateTime, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=True, default=0.00)
    reference_code = Column(String(100), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    member = relationship("Member", backref="raw_transactions")
