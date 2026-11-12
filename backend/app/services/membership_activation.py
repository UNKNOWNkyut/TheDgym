"""
Membership Payment Auto-Activation & Admin Notification Service.

Centralizes post-payment activation so every payment path (front-desk assignment,
payment confirmation update, or future PayMongo/GCash/Maya webhook) enforces
identical domain rules without duplicating logic across routers:
1. Automatically sets both the membership record and the member profile to ACTIVE.
2. Triggers an in-app + live WebSocket notification to all active Admins for newly
   activated members, excluding Day Pass walk-ins who do not have a User account.
"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services.access_service import live_feed_manager


def _is_day_pass_plan(plan: MembershipPlan) -> bool:
    slug = (plan.slug or "").strip().lower()
    return slug == "day-pass" or plan.duration_days == 1


async def _member_has_user_account(db: AsyncSession, member: Member) -> bool:
    if not member.email or not member.email.strip():
        return False
    normalized = member.email.lower().strip()
    user_id = await db.scalar(select(User.id).where(User.email == normalized))
    return user_id is not None


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
    if _is_day_pass_plan(plan) and not await _member_has_user_account(db, member):
        return False

    admins_stmt = select(User).where(
        User.role == UserRole.ADMIN,
        User.is_active.is_(True),
    )
    admins = (await db.execute(admins_stmt)).scalars().all()
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
                    f"{member.full_name} ({member.member_code}) is now active on the "
                    f"{plan.name} plan ({amount_label} paid)."
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
    Mark membership + member profile ACTIVE upon confirmed payment, and notify
    admins when this is the member's initial paid activation.
    """
    resolved_paid = paid_amount if paid_amount is not None else Decimal(str(plan.price_php))
    membership.status = MembershipStatus.ACTIVE
    membership.paid_amount = resolved_paid
    if payment_method is not None:
        membership.payment_method = payment_method

    member.status = MemberStatus.ACTIVE
    member.is_active = True

    if not is_new_member_activation:
        return False

    return await notify_admins_new_paid_member(
        db,
        member=member,
        plan=plan,
        paid_amount=resolved_paid,
    )


async def broadcast_admin_member_notification(member: Member) -> None:
    await live_feed_manager.broadcast_event(
        "admin_notification",
        {"member_code": member.member_code, "member_id": member.id},
    )
