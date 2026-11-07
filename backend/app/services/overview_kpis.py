"""
Overview Business KPIs & Shared Manila Period Service.

Computes the 9 core business KPIs for The DGym Rosario, Batangas using Asia/Manila
(UTC+8) calendar boundaries and shares exact period/revenue predicates with the
Finance router so `/api/members/stats` and `/api/finance/summary` remain 100%
mathematically aligned.
"""

from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus

MANILA_TZ = timezone(timedelta(hours=8))

MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


def get_manila_now(reference_now: Optional[datetime] = None) -> datetime:
    """Return current or provided timestamp normalized to Asia/Manila (UTC+8)."""
    if reference_now is None:
        return datetime.now(MANILA_TZ)
    if reference_now.tzinfo is None:
        return reference_now.replace(tzinfo=timezone.utc).astimezone(MANILA_TZ)
    return reference_now.astimezone(MANILA_TZ)


def period_bounds(year: int, month: Optional[int]) -> Tuple[date, date, datetime, datetime]:
    """
    Return `(start_date, end_date, start_dt_utc, end_dt_utc)` for a given year
    (and optional month) anchored to Asia/Manila (UTC+8) midnight boundaries.

    Note: Every calendar `date(Y, M, D)` serialized as `YYYY-MM-DD 00:00:00` UTC
    equals `08:00:00` Asia/Manila, so both naive/date-only values and timezone-aware
    timestamps map cleanly and without end-of-month gaps into `[start_dt_utc, end_dt_utc)`.
    """
    if month is not None:
        start_date = date(year, month, 1)
        end_date = date(year, month, monthrange(year, month)[1])
        start_manila = datetime(year, month, 1, 0, 0, 0, tzinfo=MANILA_TZ)
        if month == 12:
            end_manila = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=MANILA_TZ)
        else:
            end_manila = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=MANILA_TZ)
    else:
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        start_manila = datetime(year, 1, 1, 0, 0, 0, tzinfo=MANILA_TZ)
        end_manila = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=MANILA_TZ)

    return (
        start_date,
        end_date,
        start_manila.astimezone(timezone.utc),
        end_manila.astimezone(timezone.utc),
    )


def revenue_period_clause(start_dt: datetime, end_dt: datetime):
    """Match memberships created or starting within `[start_dt, end_dt)`."""
    return or_(
        and_(MemberMembership.created_at >= start_dt, MemberMembership.created_at < end_dt),
        and_(MemberMembership.start_date >= start_dt, MemberMembership.start_date < end_dt),
    )


async def compute_overview_kpis(
    db: AsyncSession,
    *,
    include_financials: bool,
    reference_now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Compute all 9 core business KPIs (plus legacy MemberStats fields).
    Financial KPIs (#6-#9) are computed only when `include_financials=True` (Admin).
    """
    manila_now = get_manila_now(reference_now)
    now_utc = manila_now.astimezone(timezone.utc)
    seven_days_utc = now_utc + timedelta(days=7)

    year = manila_now.year
    month = manila_now.month
    start_date, end_date, start_dt, end_dt = period_bounds(year, month)
    in_month_clause = revenue_period_clause(start_dt, end_dt)

    # 1. Single-pass Member counts: KPI #1 (active), KPI #2 (expired), KPI #3 (new_members_this_month)
    member_row = (
        await db.execute(
            select(
                func.count(Member.id),
                func.coalesce(func.sum(case((Member.status == MemberStatus.ACTIVE, 1), else_=0)), 0),
                func.coalesce(func.sum(case((Member.status == MemberStatus.EXPIRED, 1), else_=0)), 0),
                func.coalesce(func.sum(case((Member.status == MemberStatus.INACTIVE, 1), else_=0)), 0),
                func.coalesce(func.sum(case((Member.status == MemberStatus.SUSPENDED, 1), else_=0)), 0),
                func.coalesce(
                    func.sum(
                        case(
                            (and_(Member.joined_at >= start_dt, Member.joined_at < end_dt), 1),
                            else_=0,
                        )
                    ),
                    0,
                ),
            )
        )
    ).one()

    total_members = int(member_row[0] or 0)
    active_members = int(member_row[1] or 0)
    expired_members = int(member_row[2] or 0)
    inactive_members = int(member_row[3] or 0)
    suspended_members = int(member_row[4] or 0)
    new_members_this_month = int(member_row[5] or 0)

    # 2. KPI #4: Membership Renewals (2nd+ paid subscription per member — this month & all-time)
    ranked_paid = (
        select(
            MemberMembership.created_at.label("created_at"),
            MemberMembership.start_date.label("start_date"),
            func.row_number()
            .over(
                partition_by=MemberMembership.member_id,
                order_by=(MemberMembership.start_date.asc(), MemberMembership.id.asc()),
            )
            .label("rn"),
        )
        .where(
            MemberMembership.status.in_([MembershipStatus.ACTIVE, MembershipStatus.EXPIRED]),
            MemberMembership.paid_amount.is_not(None),
            MemberMembership.paid_amount > 0,
        )
        .subquery()
    )

    renewal_in_month = or_(
        and_(ranked_paid.c.created_at >= start_dt, ranked_paid.c.created_at < end_dt),
        and_(ranked_paid.c.start_date >= start_dt, ranked_paid.c.start_date < end_dt),
    )

    renewals_row = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(case((renewal_in_month, 1), else_=0)), 0),
            )
            .select_from(ranked_paid)
            .where(ranked_paid.c.rn >= 2)
        )
    ).one()

    renewals_all_time = int(renewals_row[0] or 0)
    renewals_this_month = int(renewals_row[1] or 0)

    # 3. KPI #5 (Upcoming Expirations in next 7 days) + optional KPIs #6 (Payments) & #7 (Monthly Income)
    expiring_cond = and_(
        MemberMembership.status == MembershipStatus.ACTIVE,
        MemberMembership.end_date >= now_utc,
        MemberMembership.end_date <= seven_days_utc,
    )

    if not include_financials:
        upcoming_expirations_7d = int(
            (await db.scalar(select(func.count(MemberMembership.id)).where(expiring_cond))) or 0
        )
        return {
            "total": total_members,
            "active": active_members,
            "expired": expired_members,
            "inactive": inactive_members,
            "suspended": suspended_members,
            "period_year": year,
            "period_month": month,
            "period_label": f"{MONTH_NAMES[month - 1]} {year}",
            "new_members_this_month": new_members_this_month,
            "renewals_this_month": renewals_this_month,
            "renewals_all_time": renewals_all_time,
            "upcoming_expirations_7d": upcoming_expirations_7d,
            "payments_this_month": None,
            "monthly_income": None,
            "monthly_expenses": None,
            "profit_loss": None,
        }

    paid_tx_cond = and_(
        MemberMembership.status != MembershipStatus.CANCELLED,
        MemberMembership.paid_amount.is_not(None),
        MemberMembership.paid_amount > 0,
        in_month_clause,
    )
    revenue_cond = and_(
        MemberMembership.status != MembershipStatus.CANCELLED,
        MemberMembership.paid_amount.is_not(None),
        in_month_clause,
    )

    ms_fin_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(case((expiring_cond, 1), else_=0)), 0),
                func.coalesce(func.sum(case((paid_tx_cond, 1), else_=0)), 0),
                func.coalesce(
                    func.sum(case((revenue_cond, MemberMembership.paid_amount), else_=0)),
                    0,
                ),
            )
        )
    ).one()

    upcoming_expirations_7d = int(ms_fin_row[0] or 0)
    payments_this_month = int(ms_fin_row[1] or 0)
    monthly_income = Decimal(ms_fin_row[2] or 0).quantize(Decimal("0.01"))

    # 4. KPI #8 (Monthly Expenses) & KPI #9 (Profit / Loss)
    expenses_scalar = await db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_archived.is_(False),
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
        )
    )
    monthly_expenses = Decimal(expenses_scalar or 0).quantize(Decimal("0.01"))
    profit_loss = (monthly_income - monthly_expenses).quantize(Decimal("0.01"))

    return {
        "total": total_members,
        "active": active_members,
        "expired": expired_members,
        "inactive": inactive_members,
        "suspended": suspended_members,
        "period_year": year,
        "period_month": month,
        "period_label": f"{MONTH_NAMES[month - 1]} {year}",
        "new_members_this_month": new_members_this_month,
        "renewals_this_month": renewals_this_month,
        "renewals_all_time": renewals_all_time,
        "upcoming_expirations_7d": upcoming_expirations_7d,
        "payments_this_month": payments_this_month,
        "monthly_income": str(monthly_income),
        "monthly_expenses": str(monthly_expenses),
        "profit_loss": str(profit_loss),
    }
