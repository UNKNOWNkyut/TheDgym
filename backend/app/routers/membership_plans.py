"""
Membership Plans router — manage gym plan tiers and pricing.
Membership Assignment router — assign plans to members, track payments.
"""
from datetime import timedelta, timezone, datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.membership_plan import MembershipPlan
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.member import Member
from app.models.user import User, UserRole
from app.schemas.gym import (
    MembershipPlanCreate,
    MembershipPlanResponse,
    MembershipPlanUpdate,
    AssignMembershipCreate,
    MembershipResponse,
    MembershipUpdate,
)

router = APIRouter(tags=["Membership Plans & Assignments"])


# ─────────────────────────────────────────────────────────────────────────────
# MEMBERSHIP PLANS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/plans", response_model=List[MembershipPlanResponse])
async def list_plans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all membership plans. All authenticated users can view plans."""
    result = await db.execute(
        select(MembershipPlan)
        .order_by(MembershipPlan.sort_order.asc())
    )
    return result.scalars().all()


@router.get("/api/plans/{plan_id}", response_model=MembershipPlanResponse)
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single membership plan by ID."""
    result = await db.execute(select(MembershipPlan).where(MembershipPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found.")
    return plan


@router.post("/api/plans", response_model=MembershipPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    plan_in: MembershipPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Create a new membership plan. Admin only."""
    # Check unique slug
    existing = await db.execute(select(MembershipPlan).where(MembershipPlan.slug == plan_in.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A plan with slug '{plan_in.slug}' already exists.",
        )

    plan = MembershipPlan(**plan_in.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.patch("/api/plans/{plan_id}", response_model=MembershipPlanResponse)
async def update_plan(
    plan_id: int,
    plan_update: MembershipPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Update a membership plan. Admin only."""
    result = await db.execute(select(MembershipPlan).where(MembershipPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found.")

    update_data = plan_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)

    await db.commit()
    await db.refresh(plan)
    return plan


@router.delete("/api/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Soft-delete a plan by setting is_active=False. Admin only."""
    result = await db.execute(select(MembershipPlan).where(MembershipPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found.")
    plan.is_active = False
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# MEMBERSHIP ASSIGNMENTS
# ─────────────────────────────────────────────────────────────────────────────

def _build_membership_response(ms: MemberMembership) -> MembershipResponse:
    plan_name = ms.plan.name if ms.plan else "Unknown"
    return MembershipResponse(
        id=ms.id,
        member_id=ms.member_id,
        plan_id=ms.plan_id,
        plan_name=plan_name,
        start_date=ms.start_date,
        end_date=ms.end_date,
        status=ms.status,
        paid_amount=ms.paid_amount,
        payment_method=ms.payment_method,
        payment_reference=ms.payment_reference,
        notes=ms.notes,
        created_at=ms.created_at,
    )


@router.post("/api/memberships", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED)
async def assign_membership(
    data: AssignMembershipCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Assign a membership plan to a member. Admin and Staff only."""
    # Verify member exists
    member_result = await db.execute(select(Member).where(Member.id == data.member_id))
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    # Verify plan exists and is active
    plan_result = await db.execute(select(MembershipPlan).where(MembershipPlan.id == data.plan_id))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found.")
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="This membership plan is no longer active.")

    # Calculate end_date from plan duration
    start = data.start_date
    end = start + timedelta(days=plan.duration_days)

    # Default paid_amount to plan price if not provided
    paid = data.paid_amount if data.paid_amount is not None else plan.price_php

    new_ms = MemberMembership(
        member_id=data.member_id,
        plan_id=data.plan_id,
        start_date=start,
        end_date=end,
        status=MembershipStatus.ACTIVE,
        paid_amount=paid,
        payment_method=data.payment_method,
        payment_reference=data.payment_reference,
        notes=data.notes,
        created_by_user_id=current_user.id,
    )
    db.add(new_ms)

    # Update member status to active
    member.status = "active"
    member.is_active = True

    await db.commit()
    await db.refresh(new_ms)
    # Reload with relationship for plan name
    result2 = await db.execute(select(MemberMembership).where(MemberMembership.id == new_ms.id))
    new_ms = result2.scalar_one()
    return _build_membership_response(new_ms)


@router.get("/api/memberships/{membership_id}", response_model=MembershipResponse)
async def get_membership(
    membership_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Get a membership record by ID."""
    result = await db.execute(select(MemberMembership).where(MemberMembership.id == membership_id))
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(status_code=404, detail="Membership record not found.")
    return _build_membership_response(ms)


@router.patch("/api/memberships/{membership_id}", response_model=MembershipResponse)
async def update_membership(
    membership_id: int,
    update: MembershipUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Update a membership record (status, payment info, notes). Admin and Staff only."""
    result = await db.execute(select(MemberMembership).where(MemberMembership.id == membership_id))
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(status_code=404, detail="Membership record not found.")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ms, field, value)

    await db.commit()
    await db.refresh(ms)
    return _build_membership_response(ms)
