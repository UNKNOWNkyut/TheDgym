from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    name = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
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

    created_by = relationship(
        "User",
        foreign_keys=[created_by_user_id],
        lazy="selectin",
    )

    expenses = relationship(
        "Expense",
        back_populates="category",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ExpenseCategory("
            f"id={self.id}, "
            f"name={self.name}, "
            f"active={self.is_active}"
            f")>"
        )