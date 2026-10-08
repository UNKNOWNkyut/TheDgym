from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    category_id = Column(
        Integer,
        ForeignKey("expense_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    expense_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=False,
    )

    # Reserved for receipt upload later.
    receipt_path = Column(
        String(500),
        nullable=True,
    )

    # The admin who recorded the expense.
    recorded_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Financial records are archived instead of permanently deleted.
    is_archived = Column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
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

    category = relationship(
        "ExpenseCategory",
        back_populates="expenses",
        lazy="selectin",
    )

    recorded_by = relationship(
        "User",
        foreign_keys=[recorded_by_user_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Expense("
            f"id={self.id}, "
            f"amount={self.amount}, "
            f"date={self.expense_date}"
            f")>"
        )