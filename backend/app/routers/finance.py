"""
Finance Router

Handles:
- Expense categories
- Expenses
- Financial summary
- Membership revenue
- Profit / loss

Admin only.
"""

from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.database import get_db
from app.models.expense import Expense
from app.models.expense_category import ExpenseCategory
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.user import User, UserRole
from app.services.overview_kpis import get_manila_now, period_bounds, revenue_period_clause
from app.schemas.finance import (
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCategoryTotal,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    FinanceSummaryResponse,
    MonthlyFinancePoint,
)

router = APIRouter(prefix="/api/finance", tags=["Finance"])

ANNUAL_MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def _expense_to_response(expense: Expense) -> ExpenseResponse:
    return ExpenseResponse(
        id=expense.id,
        category_id=expense.category_id,
        category_name=expense.category.name if expense.category else "Unknown",
        amount=expense.amount,
        expense_date=expense.expense_date,
        description=expense.description,
        receipt_path=expense.receipt_path,
        recorded_by_user_id=expense.recorded_by_user_id,
        recorded_by_name=expense.recorded_by.full_name if expense.recorded_by else None,
        is_archived=expense.is_archived,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
    )


def _period_bounds(year: int, month: Optional[int]):
    """Creates the starting and ending dates used by finance filters."""
    return period_bounds(year, month)


def _revenue_period_clause(start_date: date, end_date: date, start_dt: datetime, end_dt: datetime):
    return revenue_period_clause(start_dt, end_dt)


async def _get_category_or_404(db: AsyncSession, category_id: int) -> ExpenseCategory:
    stmt = select(ExpenseCategory).where(ExpenseCategory.id == category_id)
    category = (await db.execute(stmt)).scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense category not found.",
        )
    return category


async def _load_expense_or_404(db: AsyncSession, expense_id: int) -> Expense:
    stmt = (
        select(Expense)
        .where(Expense.id == expense_id)
        .options(selectinload(Expense.category), selectinload(Expense.recorded_by))
    )
    expense = (await db.execute(stmt)).scalar_one_or_none()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found.",
        )
    return expense


# =========================================================
# EXPENSE CATEGORIES
# =========================================================

@router.get("/categories", response_model=List[ExpenseCategoryResponse])
async def list_expense_categories(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    stmt = select(ExpenseCategory)
    if not include_inactive:
        stmt = stmt.where(ExpenseCategory.is_active.is_(True))
    stmt = stmt.order_by(ExpenseCategory.name.asc())
    return (await db.execute(stmt)).scalars().all()


@router.post(
    "/categories",
    response_model=ExpenseCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_expense_category(
    data: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    clean_name = data.name.strip()
    existing = await db.execute(
        select(ExpenseCategory).where(func.lower(ExpenseCategory.name) == clean_name.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An expense category with this name already exists.",
        )

    category = ExpenseCategory(
        name=clean_name,
        description=data.description.strip() if data.description else None,
        created_by_user_id=current_user.id,
        is_active=True,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=ExpenseCategoryResponse)
async def update_expense_category(
    category_id: int,
    data: ExpenseCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    category = await _get_category_or_404(db, category_id)
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        clean_name = update_data["name"].strip()
        duplicate = await db.execute(
            select(ExpenseCategory).where(
                func.lower(ExpenseCategory.name) == clean_name.lower(),
                ExpenseCategory.id != category_id,
            )
        )
        if duplicate.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An expense category with this name already exists.",
            )
        update_data["name"] = clean_name

    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = update_data["description"].strip()

    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_expense_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    category = await _get_category_or_404(db, category_id)
    category.is_active = False
    await db.commit()


# =========================================================
# EXPENSES
# =========================================================

@router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None, ge=1),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A year is required when filtering by month.",
        )

    stmt = (
        select(Expense)
        .join(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
        .options(selectinload(Expense.category), selectinload(Expense.recorded_by))
    )

    if not include_archived:
        stmt = stmt.where(Expense.is_archived.is_(False))
    if category_id is not None:
        stmt = stmt.where(Expense.category_id == category_id)
    if year is not None:
        start_date, end_date, _, _ = _period_bounds(year, month)
        stmt = stmt.where(Expense.expense_date >= start_date, Expense.expense_date <= end_date)
    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Expense.description.ilike(search_term),
                ExpenseCategory.name.ilike(search_term),
            )
        )

    stmt = stmt.order_by(Expense.expense_date.desc(), Expense.id.desc()).offset(skip).limit(limit)
    expenses = (await db.execute(stmt)).scalars().all()
    return [_expense_to_response(expense) for expense in expenses]


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    expense = await _load_expense_or_404(db, expense_id)
    return _expense_to_response(expense)


@router.post(
    "/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    category = await _get_category_or_404(db, data.category_id)
    if not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This expense category is inactive.",
        )

    expense = Expense(
        category_id=data.category_id,
        amount=data.amount,
        expense_date=data.expense_date,
        description=data.description.strip(),
        receipt_path=data.receipt_path.strip() if data.receipt_path else None,
        recorded_by_user_id=current_user.id,
        is_archived=False,
    )
    db.add(expense)
    await db.commit()
    return _expense_to_response(await _load_expense_or_404(db, expense.id))


@router.patch("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    expense = await _load_expense_or_404(db, expense_id)
    if expense.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived expenses cannot be edited.",
        )

    update_data = data.model_dump(exclude_unset=True)
    if "category_id" in update_data:
        category = await _get_category_or_404(db, update_data["category_id"])
        if not category.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This expense category is inactive.",
            )

    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = update_data["description"].strip()
    if "receipt_path" in update_data and update_data["receipt_path"] is not None:
        update_data["receipt_path"] = update_data["receipt_path"].strip()

    for field, value in update_data.items():
        setattr(expense, field, value)

    await db.commit()
    return _expense_to_response(await _load_expense_or_404(db, expense_id))


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    expense = await _load_expense_or_404(db, expense_id)
    expense.is_archived = True
    await db.commit()


# =========================================================
# FINANCIAL SUMMARY
# =========================================================

@router.get("/summary", response_model=FinanceSummaryResponse)
async def get_finance_summary(
    year: int = Query(..., ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    manila_now = get_manila_now()

    # Future months return 0.00
    if month is not None and (year > manila_now.year or (year == manila_now.year and month > manila_now.month)):
        return FinanceSummaryResponse(
            year=year,
            month=month,
            membership_revenue=Decimal("0.00"),
            total_expenses=Decimal("0.00"),
            profit=Decimal("0.00"),
            expenses_by_category=[],
        )

    start_date, end_date, start_dt, end_dt = _period_bounds(year, month)

    # For full-year view of current year, sum up through the current Manila month
    if month is None and year == manila_now.year:
        start_date = date(year, 1, 1)
        end_date = date(year, manila_now.month, monthrange(year, manila_now.month)[1])
        _, _, start_dt, _ = _period_bounds(year, 1)
        _, _, _, end_dt = _period_bounds(year, manila_now.month)

    # MEMBERSHIP REVENUE
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(MemberMembership.paid_amount), 0)).where(
            MemberMembership.status != MembershipStatus.CANCELLED,
            MemberMembership.paid_amount.is_not(None),
            _revenue_period_clause(start_date, end_date, start_dt, end_dt),
        )
    )
    membership_revenue = Decimal(revenue_result.scalar_one() or 0)

    # TOTAL EXPENSES
    expenses_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_archived.is_(False),
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
        )
    )
    total_expenses = Decimal(expenses_result.scalar_one() or 0)

    # EXPENSE BREAKDOWN BY CATEGORY
    breakdown_result = await db.execute(
        select(
            ExpenseCategory.id,
            ExpenseCategory.name,
            func.coalesce(func.sum(Expense.amount), 0),
        )
        .join(Expense, Expense.category_id == ExpenseCategory.id)
        .where(
            Expense.is_archived.is_(False),
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
        )
        .group_by(ExpenseCategory.id, ExpenseCategory.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    breakdown = [
        ExpenseCategoryTotal(
            category_id=category_id,
            category_name=category_name,
            total=Decimal(total or 0),
        )
        for category_id, category_name, total in breakdown_result.all()
    ]

    # PROFIT / LOSS
    return FinanceSummaryResponse(
        year=year,
        month=month,
        membership_revenue=membership_revenue,
        total_expenses=total_expenses,
        profit=membership_revenue - total_expenses,
        expenses_by_category=breakdown,
    )


@router.get(
    "/annual",
    response_model=List[MonthlyFinancePoint],
    summary="Get 12-month annual finance breakdown of revenue, expenses, and net income",
)
async def get_annual_finance_breakdown(
    year: int = Query(..., ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    manila_now = get_manila_now()

    # Future years return 0.00
    if year > manila_now.year:
        return [
            MonthlyFinancePoint(
                month=m,
                month_name=ANNUAL_MONTH_NAMES[m - 1],
                revenue=Decimal("0.00"),
                expenses=Decimal("0.00"),
                net_income=Decimal("0.00"),
            )
            for m in range(1, 13)
        ]

    max_month = manila_now.month if year == manila_now.year else 12
    range_start_date = date(year, 1, 1)
    range_end_date = date(year, max_month, monthrange(year, max_month)[1])
    _, _, range_start_dt, _ = _period_bounds(year, 1)
    _, _, _, range_end_dt = _period_bounds(year, max_month)

    # Revenue (single pass across completed months instead of 12 sequential queries)
    rev_cols = [
        func.coalesce(
            func.sum(
                case(
                    (_revenue_period_clause(*_period_bounds(year, m)), MemberMembership.paid_amount),
                    else_=0,
                )
            ),
            0,
        )
        for m in range(1, max_month + 1)
    ]
    rev_row = (
        await db.execute(
            select(*rev_cols).where(
                MemberMembership.status != MembershipStatus.CANCELLED,
                MemberMembership.paid_amount.is_not(None),
                _revenue_period_clause(range_start_date, range_end_date, range_start_dt, range_end_dt),
            )
        )
    ).one()
    rev_by_month = {m: Decimal(rev_row[m - 1] or 0) for m in range(1, max_month + 1)}

    # Expenses (single GROUP BY month query instead of 12 sequential queries)
    month_expr = extract("month", Expense.expense_date)
    exp_rows = (
        await db.execute(
            select(month_expr, func.coalesce(func.sum(Expense.amount), 0))
            .where(
                Expense.is_archived.is_(False),
                Expense.expense_date >= range_start_date,
                Expense.expense_date <= range_end_date,
            )
            .group_by(month_expr)
        )
    ).all()
    exp_by_month = {int(m): Decimal(total or 0) for m, total in exp_rows}

    points: List[MonthlyFinancePoint] = []
    for m in range(1, 13):
        if m > max_month:
            points.append(
                MonthlyFinancePoint(
                    month=m,
                    month_name=ANNUAL_MONTH_NAMES[m - 1],
                    revenue=Decimal("0.00"),
                    expenses=Decimal("0.00"),
                    net_income=Decimal("0.00"),
                )
            )
            continue

        rev = rev_by_month.get(m, Decimal(0))
        exp = exp_by_month.get(m, Decimal(0))
        points.append(
            MonthlyFinancePoint(
                month=m,
                month_name=ANNUAL_MONTH_NAMES[m - 1],
                revenue=rev,
                expenses=exp,
                net_income=rev - exp,
            )
        )
    return points
