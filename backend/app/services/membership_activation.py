"""
Membership Payment Auto-Activation & Admin Notification Service.

Centralizes post-payment activation so every payment path (front-desk assignment,
payment confirmation update, or future PayMongo/GCash/Maya webhook) enforces
identical domain rules without duplicating logic across routers:
1. Automatically sets both the membership record and the member profile to ACTIVE.
2. Promotes a registered USER account (`role='user'`) to MEMBER (`role='member'`) on payment.
3. Expires elapsed memberships (including 24-hour Day Passes) and demotes lapsed MEMBER accounts back to USER.
4. Triggers in-app + live WebSocket notifications to all active Admins for newly
   registered users and newly activated/paid members.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy import and_, delete, func, not_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import as_utc as _as_utc
from app.models.class_session import ClassEnrollment
from app.models.keycard_tap_log import KeycardTapLog
from app.models.member import Member, MemberStatus
from app.models.member_keycard import MemberKeycard
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.member_progress import ClientProgressEntry, MemberTrainingPlan
from app.models.membership_plan import MembershipPlan
from app.models.notification import Notification
from app.models.pairing_session import PairingSession
from app.models.prediction import Prediction
from app.models.processed_customer import ProcessedCustomer
from app.models.pt_session import PTSession
from app.models.raw_transaction import RawTransaction
from app.models.retention_strategy import RetentionStrategy
from app.models.user import User, UserRole
from app.models.visit import Visit
from app.services.access_service import live_feed_manager
from app.services.pagination import read_page_cache


def is_day_pass_plan(plan: MembershipPlan) -> bool:
    slug = (plan.slug or "").strip().lower()
    return slug == "day-pass" or plan.duration_days == 1


_is_day_pass_plan = is_day_pass_plan

_DAY_PASS_PLAN_COND = or_(
    func.lower(MembershipPlan.slug) == "day-pass",
    MembershipPlan.duration_days == 1,
)


def real_member_filter_clause():
    """Exclude Day-Pass-only profiles and non-customer (Admin/Trainer/Staff) links from Member listings/counts."""
    has_day_pass = Member.memberships.any(
        and_(
            MemberMembership.status != MembershipStatus.CANCELLED,
            MemberMembership.plan.has(_DAY_PASS_PLAN_COND),
        )
    )
    has_real_plan = Member.memberships.any(
        and_(
            MemberMembership.status != MembershipStatus.CANCELLED,
            MemberMembership.plan.has(not_(_DAY_PASS_PLAN_COND)),
        )
    )
    non_customer_emails = select(func.lower(User.email)).where(
        User.role.in_([UserRole.ADMIN, UserRole.TRAINER, UserRole.STAFF])
    )
    is_non_customer_user = and_(
        Member.email.is_not(None),
        func.lower(Member.email).in_(non_customer_emails),
    )
    return and_(
        or_(not_(has_day_pass), has_real_plan),
        not_(is_non_customer_user),
    )


async def _find_user_by_email(db: AsyncSession, email: Optional[str]) -> Optional[User]:
    if not email or not email.strip():
        return None
    normalized = email.lower().strip()
    return (
        await db.execute(select(User).where(func.lower(User.email) == normalized))
    ).scalar_one_or_none()


async def _member_has_user_account(db: AsyncSession, member: Member) -> bool:
    return (await _find_user_by_email(db, member.email)) is not None


async def _get_active_admins(db: AsyncSession) -> list[User]:
    stmt = select(User).where(
        User.role == UserRole.ADMIN,
        User.is_active.is_(True),
    )
    return list((await db.execute(stmt)).scalars().all())


async def notify_admins_new_registered_user(
    db: AsyncSession,
    *,
    user: User,
) -> bool:
    """Queue an in-app notification for all active Admins when a new visitor registers."""
    admins = await _get_active_admins(db)
    if not admins:
        return False

    for admin_user in admins:
        db.add(
            Notification(
                user_id=admin_user.id,
                title=f"New Registered User: {user.full_name}",
                message=f"{user.full_name} ({user.email}) created an account as a registered user.",
                type="registration",
                action_text="View Users",
                action_url="/manage/users",
                is_read=False,
            )
        )
    return True


async def notify_admins_new_paid_member(
    db: AsyncSession,
    *,
    member: Member,
    plan: MembershipPlan,
    paid_amount: Decimal,
) -> bool:
    """
    Notify all active Admins about a newly activated member, excluding Day Pass
    users who do not have a registered account.
    Returns True when at least one admin notification was queued.
    """
    if is_day_pass_plan(plan) and not await _member_has_user_account(db, member):
        return False

    admins = await _get_active_admins(db)
    if not admins:
        return False

    amount_label = f"₱{Decimal(str(paid_amount)):,.2f}"
    for admin_user in admins:
        db.add(
            Notification(
                user_id=admin_user.id,
                member_id=member.id,
                title=f"New Active Member: {member.full_name}",
                message=(
                    f"{member.full_name} ({member.member_code}) availed the "
                    f"{plan.name} plan ({amount_label} paid) and is now an active member."
                ),
                type="announcement",
                action_text="View Profile",
                action_url=f"/manage/members/{member.id}",
                is_read=False,
            )
        )
    return True


async def count_prior_paid_memberships(
    db: AsyncSession,
    *,
    member_id: int,
    exclude_membership_id: Optional[int] = None,
) -> int:
    stmt = select(func.count()).select_from(MemberMembership).where(
        MemberMembership.member_id == member_id,
        MemberMembership.status.in_([MembershipStatus.ACTIVE, MembershipStatus.EXPIRED]),
    )
    if exclude_membership_id is not None:
        stmt = stmt.where(MemberMembership.id != exclude_membership_id)
    count = await db.scalar(stmt)
    return int(count or 0)


async def has_other_active_membership(
    db: AsyncSession,
    *,
    member_id: int,
    exclude_membership_id: Optional[int] = None,
    now: Optional[datetime] = None,
) -> bool:
    ref_now = _as_utc(now) or datetime.now(timezone.utc)
    stmt = select(MemberMembership).where(
        MemberMembership.member_id == member_id,
        MemberMembership.status == MembershipStatus.ACTIVE,
    )
    if exclude_membership_id is not None:
        stmt = stmt.where(MemberMembership.id != exclude_membership_id)
    rows = (await db.execute(stmt)).scalars().all()
    return any((_as_utc(ms.end_date) or ref_now) > ref_now for ms in rows)


async def activate_member_and_notify_on_payment(
    db: AsyncSession,
    *,
    membership: MemberMembership,
    member: Member,
    plan: MembershipPlan,
    paid_amount: Optional[Decimal] = None,
    payment_method: Optional[PaymentMethod] = None,
    is_new_member_activation: bool = False,
) -> bool:
    """
    Mark membership + member profile ACTIVE upon confirmed payment, promote
    any linked USER account to MEMBER, and notify admins when activated.
    """
    resolved_paid = paid_amount if paid_amount is not None else Decimal(str(plan.price_php))
    membership.status = MembershipStatus.ACTIVE
    membership.paid_amount = resolved_paid
    if payment_method is not None:
        membership.payment_method = payment_method
    membership.payer_name_snapshot = membership.payer_name_snapshot or member.full_name
    membership.plan_name_snapshot = membership.plan_name_snapshot or plan.name

    member.status = MemberStatus.ACTIVE
    member.is_active = True

    day_pass = is_day_pass_plan(plan)
    linked_user = await _find_user_by_email(db, member.email)
    if linked_user is not None and linked_user.role == UserRole.USER and not day_pass:
        linked_user.role = UserRole.MEMBER

    read_page_cache.invalidate_prefix("members:", "users:")

    if not is_new_member_activation or day_pass:
        return False

    return await notify_admins_new_paid_member(
        db,
        member=member,
        plan=plan,
        paid_amount=resolved_paid,
    )


async def detach_and_delete_member(db: AsyncSession, member: Member) -> None:
    """
    Delete a Member profile cleanly while decoupling paid MemberMembership ledger rows
    (`member_id = NULL` + payer/plan snapshots) so Finance revenue totals stay intact.
    """
    member_id = member.id
    member_card_ids = select(MemberKeycard.id).where(MemberKeycard.member_id == member_id)
    member_visit_ids = select(Visit.id).where(Visit.member_id == member_id)

    await db.execute(
        update(KeycardTapLog)
        .where(
            or_(
                KeycardTapLog.member_id == member_id,
                KeycardTapLog.keycard_id.in_(member_card_ids),
                KeycardTapLog.visit_id.in_(member_visit_ids),
            )
        )
        .values(member_id=None, keycard_id=None, visit_id=None)
    )
    await db.execute(
        update(Visit).where(Visit.keycard_id.in_(member_card_ids)).values(keycard_id=None)
    )

    ms_rows = (
        await db.execute(
            select(MemberMembership)
            .where(MemberMembership.member_id == member_id)
            .options(selectinload(MemberMembership.plan))
        )
    ).scalars().all()
    for ms in ms_rows:
        is_paid = (
            ms.status != MembershipStatus.CANCELLED
            and ms.paid_amount is not None
            and Decimal(str(ms.paid_amount)) > Decimal("0.00")
        )
        if is_paid:
            ms.payer_name_snapshot = ms.payer_name_snapshot or member.full_name
            ms.plan_name_snapshot = ms.plan_name_snapshot or (ms.plan.name if ms.plan else None)
            ms.member_id = None
            if ms.status == MembershipStatus.ACTIVE:
                ms.status = MembershipStatus.EXPIRED
        else:
            await db.delete(ms)

    await db.flush()

    for model, col in (
        (MemberKeycard, MemberKeycard.member_id),
        (PairingSession, PairingSession.member_id),
        (MemberTrainingPlan, MemberTrainingPlan.member_id),
        (ClientProgressEntry, ClientProgressEntry.member_id),
        (Notification, Notification.member_id),
        (RetentionStrategy, RetentionStrategy.member_id),
        (Prediction, Prediction.customer_id),
        (ProcessedCustomer, ProcessedCustomer.customer_id),
        (RawTransaction, RawTransaction.customer_id),
        (PTSession, PTSession.member_id),
        (ClassEnrollment, ClassEnrollment.member_id),
        (Visit, Visit.member_id),
        (Member, Member.id),
    ):
        await db.execute(delete(model).where(col == member_id))


async def expire_elapsed_memberships(
    db: AsyncSession,
    *,
    now: Optional[datetime] = None,
) -> int:
    """
    Mark any ACTIVE membership whose `end_date <= now` as EXPIRED.
    If the member has no other remaining active plan, mark their Member profile
    EXPIRED and automatically demote their linked User role from MEMBER back to USER.
    """
    ref_now = _as_utc(now) or datetime.now(timezone.utc)
    active_rows = (
        await db.execute(
            select(MemberMembership).where(MemberMembership.status == MembershipStatus.ACTIVE)
        )
    ).scalars().all()

    expired_member_ids: set[int] = set()
    expired_count = 0
    for ms in active_rows:
        end_utc = _as_utc(ms.end_date)
        if end_utc is not None and end_utc <= ref_now:
            ms.status = MembershipStatus.EXPIRED
            if ms.member_id is not None:
                expired_member_ids.add(ms.member_id)
            expired_count += 1

    if not expired_member_ids:
        return 0

    for member_id in expired_member_ids:
        still_active = await has_other_active_membership(
            db, member_id=member_id, now=ref_now
        )
        if still_active:
            continue

        member = await db.get(Member, member_id)
        if member is None:
            continue
        if member.status == MemberStatus.ACTIVE:
            member.status = MemberStatus.EXPIRED

        linked_user = await _find_user_by_email(db, member.email)
        if linked_user is not None and linked_user.role == UserRole.MEMBER:
            linked_user.role = UserRole.USER

    read_page_cache.invalidate_prefix("members:", "users:")
    return expired_count


async def broadcast_admin_event(payload: Dict[str, Any]) -> None:
    await live_feed_manager.broadcast_event("admin_notification", payload)


async def broadcast_admin_member_notification(member: Member) -> None:
    await broadcast_admin_event({"member_code": member.member_code, "member_id": member.id})


async def broadcast_admin_user_registration(user: User) -> None:
    await broadcast_admin_event({"event_type": "user_registered", "user_id": user.id})
