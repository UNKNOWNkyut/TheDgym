"""Seed demo smart keycards, scanner terminal, and test memberships if missing."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.access_scanner import AccessScanner, ScannerTapMode, hash_scanner_api_key
from app.models.member import Member, MemberStatus
from app.models.member_keycard import (
    KeycardStatus,
    MemberKeycard,
    hash_card_uid,
    mask_card_uid,
)
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan


async def seed_keycards(session: AsyncSession) -> None:
    """Idempotently seed default front-desk scanner and sample member keycards."""
    now = datetime.now(timezone.utc)

    # 1. Seed default Front Desk Scanner Terminal if missing
    existing_scanner = (await session.execute(select(AccessScanner).limit(1))).scalar_one_or_none()
    if not existing_scanner:
        dev_key = "dgym_scan_dev_frontdesk_terminal_key"
        session.add(
            AccessScanner(
                name="Front Desk USB NFC Reader",
                location="Main Reception Lobby",
                api_key_hash=hash_scanner_api_key(dev_key),
                api_key_prefix=dev_key[:14],
                tap_mode=ScannerTapMode.TOGGLE_IN_OUT,
                is_active=True,
                last_heartbeat_at=now,
            )
        )

    plan = (
        await session.execute(select(MembershipPlan).where(MembershipPlan.is_active.is_(True)).limit(1))
    ).scalar_one_or_none()

    all_members = list((await session.execute(select(Member).order_by(Member.id.asc()))).scalars().all())
    if not all_members:
        await session.commit()
        return

    active_members = [m for m in all_members if m.is_active and m.status == MemberStatus.ACTIVE]
    expired_members = [m for m in all_members if m.status == MemberStatus.EXPIRED]

    async def _card_exists(raw_uid: str) -> bool:
        h = hash_card_uid(raw_uid)
        found = (
            await session.execute(select(MemberKeycard).where(MemberKeycard.card_uid_hash == h).limit(1))
        ).scalar_one_or_none()
        return found is not None

    async def _member_has_active_card(member_id: int) -> bool:
        found = (
            await session.execute(
                select(MemberKeycard)
                .where(MemberKeycard.member_id == member_id, MemberKeycard.status == KeycardStatus.ACTIVE)
                .limit(1)
            )
        ).scalar_one_or_none()
        return found is not None

    async def _ensure_membership(
        member_obj: Member,
        start_offset_days: int,
        end_offset_days: int,
        ms_status: MembershipStatus,
    ) -> None:
        if not plan:
            return
        has_ms = (
            await session.execute(
                select(MemberMembership).where(MemberMembership.member_id == member_obj.id).limit(1)
            )
        ).scalar_one_or_none()
        if not has_ms:
            session.add(
                MemberMembership(
                    member_id=member_obj.id,
                    plan_id=plan.id,
                    start_date=now + timedelta(days=start_offset_days),
                    end_date=now + timedelta(days=end_offset_days),
                    status=ms_status,
                    paid_amount=plan.price_php,
                    payment_method=PaymentMethod.CASH,
                    notes="Seeded for Smart Keycard verification testing",
                )
            )

    # Preset 1: Active Member (04A1B2C30001)
    if active_members and not await _card_exists("04A1B2C30001"):
        m1 = active_members[0]
        if not await _member_has_active_card(m1.id):
            await _ensure_membership(m1, -5, 25, MembershipStatus.ACTIVE)
            session.add(
                MemberKeycard(
                    member_id=m1.id,
                    card_uid_hash=hash_card_uid("04A1B2C30001"),
                    card_uid_masked=mask_card_uid("04A1B2C30001"),
                    card_label="Primary PVC Keycard",
                    status=KeycardStatus.ACTIVE,
                    issued_at=now - timedelta(days=10),
                )
            )

    # Preset 2: Active Expiring Soon (04A1B2C30002)
    if len(active_members) >= 2 and not await _card_exists("04A1B2C30002"):
        m2 = active_members[1]
        if not await _member_has_active_card(m2.id):
            await _ensure_membership(m2, -27, 3, MembershipStatus.ACTIVE)
            session.add(
                MemberKeycard(
                    member_id=m2.id,
                    card_uid_hash=hash_card_uid("04A1B2C30002"),
                    card_uid_masked=mask_card_uid("04A1B2C30002"),
                    card_label="Silicone NFC Wristband",
                    status=KeycardStatus.ACTIVE,
                    issued_at=now - timedelta(days=10),
                )
            )

    # Preset 3: Reported Lost / Stolen Card (04DEAD990003) — safe on any existing member as historical LOST card
    if active_members and not await _card_exists("04DEAD990003"):
        target_m = active_members[min(2, len(active_members) - 1)]
        session.add(
            MemberKeycard(
                member_id=target_m.id,
                card_uid_hash=hash_card_uid("04DEAD990003"),
                card_uid_masked=mask_card_uid("04DEAD990003"),
                card_label="Previous PVC Keycard",
                status=KeycardStatus.LOST,
                issued_at=now - timedelta(days=30),
                revoked_at=now - timedelta(days=2),
                revoked_reason="Member reported lost in locker room",
            )
        )

    # Preset 4: Expired Membership Card (04EXPIRED999) — find member with no future active membership
    if not await _card_exists("04EXPIRED999"):
        candidate_exp: Member | None = None
        for m in all_members:
            if await _member_has_active_card(m.id):
                continue
            ms_rows = (
                await session.execute(select(MemberMembership).where(MemberMembership.member_id == m.id))
            ).scalars().all()
            has_valid_future = any(
                ms.status == MembershipStatus.ACTIVE
                and (ms.end_date.replace(tzinfo=timezone.utc) if ms.end_date.tzinfo is None else ms.end_date) >= now
                for ms in ms_rows
            )
            if not has_valid_future:
                candidate_exp = m
                break

        if candidate_exp:
            await _ensure_membership(candidate_exp, -40, -10, MembershipStatus.EXPIRED)
            session.add(
                MemberKeycard(
                    member_id=candidate_exp.id,
                    card_uid_hash=hash_card_uid("04EXPIRED999"),
                    card_uid_masked=mask_card_uid("04EXPIRED999"),
                    card_label="Primary PVC Keycard",
                    status=KeycardStatus.ACTIVE,
                    issued_at=now - timedelta(days=40),
                )
            )

    await session.commit()
