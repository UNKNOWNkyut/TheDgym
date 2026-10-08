from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# =========================================================
# EXPENSE CATEGORIES
# =========================================================

class ExpenseCategoryCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    description: Optional[str] = Field(
        None,
        max_length=1000,
    )


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
    )

    description: Optional[str] = Field(
        None,
        max_length=1000,
    )

    is_active: Optional[bool] = None


class ExpenseCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =========================================================
# EXPENSES
# =========================================================

class ExpenseCreate(BaseModel):
    category_id: int = Field(
        ...,
        ge=1,
    )

    amount: Decimal = Field(
        ...,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    expense_date: date

    description: str = Field(
        ...,
        min_length=1,
        max_length=2000,
    )

    receipt_path: Optional[str] = Field(
        None,
        max_length=500,
    )


class ExpenseUpdate(BaseModel):
    category_id: Optional[int] = Field(
        None,
        ge=1,
    )

    amount: Optional[Decimal] = Field(
        None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    expense_date: Optional[date] = None

    description: Optional[str] = Field(
        None,
        min_length=1,
        max_length=2000,
    )

    receipt_path: Optional[str] = Field(
        None,
        max_length=500,
    )


class ExpenseResponse(BaseModel):
    id: int

    category_id: int
    category_name: str

    amount: Decimal
    expense_date: date
    description: str

    receipt_path: Optional[str] = None

    recorded_by_user_id: Optional[int] = None
    recorded_by_name: Optional[str] = None

    is_archived: bool

    created_at: datetime
    updated_at: datetime


# =========================================================
# FINANCIAL SUMMARY
# =========================================================

class ExpenseCategoryTotal(BaseModel):
    category_id: int
    category_name: str
    total: Decimal


class FinanceSummaryResponse(BaseModel):
    year: int
    month: Optional[int] = None

    membership_revenue: Decimal
    total_expenses: Decimal
    profit: Decimal

    expense_count: int

    expenses_by_category: list[ExpenseCategoryTotal]