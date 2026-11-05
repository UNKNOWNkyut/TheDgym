"""Smart keycard access engine: tap verification pipeline, pairing session state, and live-feed hub.

HTTP routes live in app/routers/access_control.py; this module has no routing concerns.
"""
import asyncio
import math
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException, Request, WebSocket, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.access_scanner import AccessScanner, ScannerTapMode
from app.models.class_session import ClassEnrollment, ClassSession, ClassStatus
from app.models.keycard_tap_log import KeycardTapLog, TapDecision
from app.models.member import Member, MemberStatus
from app.models.member_keycard import (
    KeycardStatus,
    MemberKeycard,
    hash_card_uid,
    mask_card_uid,
    normalize_card_uid,
)
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.notification import Notification
from app.models.pt_session import PTSession, PTSessionStatus
from app.models.user import User
from app.models.visit import EntryMethod, Visit, VisitType
from app.schemas.access_control import PairingSessionStatus, TapVerificationResponse
from app.services.audit import record_audit_log
from app.services.visit_sweeper import (
    notify_admins_on_checkin,
    sweep_overdue_open_visits,
    to_ph_time,
)

# Standard Production Cooldowns (10 min Check-In -> Check-Out guard, 5 min Post-Checkout guard)
STANDARD_CHECKIN_COOLDOWN_SECS = 10 * 60
STANDARD_POST_CHECKOUT_COOLDOWN_SECS = 5 * 60

EXPIRING_SOON_DAYS = 5
PAIRING_MODE_TTL_SECS = 90


# ──────────────────────────────────────────────────────────────────────────────
# Smart Pairing Session State
# ──────────────────────────────────────────────────────────────────────────────

class AccessRuntimeState:
    def __init__(self) -> None:
        self.pairing_member_id: Optional[int] = None
        self.pairing_member_code: Optional[str] = None
        self.pairing_member_name: Optional[str] = None
        self.pairing_card_label: str = "Primary PVC Keycard"
        self.pairing_actor_id: Optional[int] = None
        self.pairing_expires_at: Optional[datetime] = None

    def clear_if_expired(self, now: datetime) -> None:
        if self.pairing_expires_at and now >= self.pairing_expires_at:
            self.clear_pairing()

    def clear_pairing(self) -> None:
        self.pairing_member_id = None
        self.pairing_member_code = None
        self.pairing_member_name = None
        self.pairing_card_label = "Primary PVC Keycard"
        self.pairing_actor_id = None
        self.pairing_expires_at = None

    def to_pairing_status(self, now: Optional[datetime] = None) -> PairingSessionStatus:
        ref = now or datetime.now(timezone.utc)
        self.clear_if_expired(ref)
        if not self.pairing_member_id:
            return PairingSessionStatus(active=False)
        return PairingSessionStatus(
            active=True,
            member_id=self.pairing_member_id,
            member_code=self.pairing_member_code,
            member_name=self.pairing_member_name,
            card_label=self.pairing_card_label,
            expires_at=self.pairing_expires_at,
        )


runtime_state = AccessRuntimeState()


# ──────────────────────────────────────────────────────────────────────────────
# Real-Time WebSocket Connection Manager
# ──────────────────────────────────────────────────────────────────────────────

class AccessFeedConnectionManager:
    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)

    async def broadcast_event(self, event_name: str, data: Any) -> None:
        async with self._lock:
            targets = list(self._connections)
        if not targets:
            return
        stale: List[WebSocket] = []
        message = {"event": event_name, "data": data}
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    self._connections.discard(ws)

    async def broadcast_tap(self, payload: dict) -> None:
        await self.broadcast_event("keycard_tap", payload)


live_feed_manager = AccessFeedConnectionManager()


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _membership_effective_end_utc(end_date: datetime) -> datetime:
    """
    Ensure a member whose membership expires on a given date in Philippine Time
    can still enter until 11:59:59 PM PH Time on that expiration date.
    """
    end_ph = to_ph_time(end_date)
    eod_ph = end_ph.replace(hour=23, minute=59, second=59, microsecond=999999)
    return eod_ph.astimezone(timezone.utc)


def _fmt_ph_clock(dt: datetime) -> str:
    """Philippine-time 12-hour clock label, e.g. '9:05 AM'."""
    return to_ph_time(dt).strftime("%I:%M %p").lstrip("0")


async def _infer_visit_type_and_notify_trainer(
    db: AsyncSession,
    member: Member,
    now: datetime,
) -> VisitType:
    window_start = now - timedelta(minutes=45)
    window_end = now + timedelta(minutes=90)

    pt_stmt = (
        select(PTSession)
        .where(
            PTSession.member_id == member.id,
            PTSession.status.in_([PTSessionStatus.CONFIRMED, PTSessionStatus.SCHEDULED]),
            PTSession.scheduled_at >= window_start,
            PTSession.scheduled_at <= window_end,
        )
        .order_by(PTSession.scheduled_at.asc())
        .limit(1)
    )
    pt_session = (await db.execute(pt_stmt)).scalar_one_or_none()
    if pt_session:
        if pt_session.trainer_id:
            db.add(
                Notification(
                    user_id=pt_session.trainer_id,
                    title="🏋️ PT Client Tapped In",
                    message=(
                        f"{member.full_name} ({member.member_code}) just checked in via Smart Keycard "
                        f"for their scheduled PT session."
                    ),
                    type="session_alert",
                    action_text="Open PT Schedule",
                    action_url="/manage/pt-sessions",
                    is_read=False,
                )
            )
        return VisitType.PT_SESSION

    cls_stmt = (
        select(ClassEnrollment)
        .join(ClassSession, ClassEnrollment.class_session_id == ClassSession.id)
        .where(
            ClassEnrollment.member_id == member.id,
            ClassSession.status.in_([ClassStatus.SCHEDULED, ClassStatus.ONGOING]),
            ClassSession.scheduled_at >= window_start,
            ClassSession.scheduled_at <= window_end,
        )
        .limit(1)
    )
    cls_enrollment = (await db.execute(cls_stmt)).scalar_one_or_none()
    if cls_enrollment:
        return VisitType.CLASS

    return VisitType.OPEN_GYM


async def bind_card_to_member(
    db: AsyncSession,
    *,
    member: Member,
    raw_uid: str,
    card_label: str,
    actor_user_id: Optional[int],
    now: datetime,
) -> MemberKeycard:
    norm_uid = normalize_card_uid(raw_uid)
    uid_hash = hash_card_uid(norm_uid)
    uid_masked = mask_card_uid(norm_uid)

    existing_stmt = select(MemberKeycard).where(MemberKeycard.card_uid_hash == uid_hash)
    existing_card = (await db.execute(existing_stmt)).scalar_one_or_none()

    if existing_card and existing_card.member_id != member.id:
        other_member = await db.get(Member, existing_card.member_id)
        owner_label = (
            f"{other_member.full_name} ({other_member.member_code})"
            if other_member
            else f"Member #{existing_card.member_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This NFC card ({uid_masked}) is already assigned to {owner_label}. Please tap a blank/unassigned NTAG215 card.",
        )

    # Single Active Card Rule: revoke any previous active card for this member
    prev_active_stmt = select(MemberKeycard).where(
        MemberKeycard.member_id == member.id,
        MemberKeycard.status == KeycardStatus.ACTIVE,
    )
    prev_cards = (await db.execute(prev_active_stmt)).scalars().all()
    for old_card in prev_cards:
        if existing_card and old_card.id == existing_card.id:
            continue
        old_card.status = KeycardStatus.REVOKED
        old_card.revoked_at = now
        old_card.revoked_reason = "Auto-revoked upon pairing replacement smart keycard"

    if existing_card and existing_card.member_id == member.id:
        existing_card.status = KeycardStatus.ACTIVE
        existing_card.card_label = card_label
        existing_card.revoked_at = None
        existing_card.revoked_reason = None
        existing_card.issued_by_user_id = actor_user_id
        existing_card.issued_at = now
        return existing_card

    new_card = MemberKeycard(
        member_id=member.id,
        card_uid_hash=uid_hash,
        card_uid_masked=uid_masked,
        card_label=card_label,
        status=KeycardStatus.ACTIVE,
        issued_by_user_id=actor_user_id,
        issued_at=now,
    )
    db.add(new_card)
    await db.flush()
    return new_card


# ──────────────────────────────────────────────────────────────────────────────
# 1. Core Automatic Tap Verification & Log Pipeline
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class _TapContext:
    """Per-tap state shared by every step of the verification pipeline."""

    db: AsyncSession
    request: Request
    actor_user: Optional[User]
    scanner: Optional[AccessScanner]
    raw_uid: str
    uid_masked: str
    now: datetime
    started_at: float
    keycard: Optional[MemberKeycard] = None


@dataclass
class _ActivePlan:
    """Summary of the member's currently valid membership, reused in every granted response."""

    plan_name: str
    end_dt: datetime
    days_remaining: int
    warning_banner: Optional[str]

    def response_fields(self) -> Dict[str, Any]:
        return {
            "plan_name": self.plan_name,
            "membership_end_date": self.end_dt,
            "days_remaining": self.days_remaining,
            "warning_banner": self.warning_banner,
        }


async def _finalize_tap(
    ctx: _TapContext,
    *,
    granted: bool,
    decision: TapDecision,
    reason_message: str,
    privacy_safe_message: str,
    member_obj: Optional[Member] = None,
    plan_name: Optional[str] = None,
    membership_end_date: Optional[datetime] = None,
    days_remaining: Optional[int] = None,
    warning_banner: Optional[str] = None,
    visit_obj: Optional[Visit] = None,
    admin_notified: bool = False,
) -> TapVerificationResponse:
    """Persist the tap log, commit, broadcast to live feeds, and build the API response."""
    keycard = ctx.keycard
    scanner = ctx.scanner
    latency_ms = max(1, int(round((time.perf_counter() - ctx.started_at) * 1000)))
    ctx.db.add(
        KeycardTapLog(
            keycard_id=keycard.id if keycard else None,
            member_id=member_obj.id if member_obj else None,
            scanner_id=scanner.id if scanner else None,
            visit_id=visit_obj.id if visit_obj else None,
            card_uid_masked=ctx.uid_masked,
            decision=decision,
            reason_message=reason_message,
            plan_name=plan_name,
            days_remaining=days_remaining,
            warning_banner=warning_banner,
            latency_ms=latency_ms,
            tapped_at=ctx.now,
        )
    )
    await ctx.db.commit()

    visit_type_val = None
    if visit_obj and visit_obj.visit_type:
        visit_type_val = (
            visit_obj.visit_type.value
            if hasattr(visit_obj.visit_type, "value")
            else str(visit_obj.visit_type)
        )

    member_status_val = None
    if member_obj and member_obj.status:
        member_status_val = (
            member_obj.status.value
            if hasattr(member_obj.status, "value")
            else str(member_obj.status)
        )

    resp = TapVerificationResponse(
        granted=granted,
        decision=decision,
        reason_message=reason_message,
        privacy_safe_message=privacy_safe_message,
        card_uid_masked=ctx.uid_masked,
        member_id=member_obj.id if member_obj else None,
        member_code=member_obj.member_code if member_obj else None,
        member_name=member_obj.full_name if member_obj else None,
        member_status=member_status_val,
        plan_name=plan_name,
        membership_end_date=membership_end_date,
        days_remaining=days_remaining,
        warning_banner=warning_banner,
        visit_id=visit_obj.id if visit_obj else None,
        visit_type=visit_type_val,
        checked_in_at=visit_obj.checked_in_at if visit_obj else None,
        checked_out_at=visit_obj.checked_out_at if visit_obj else None,
        latency_ms=latency_ms,
        tapped_at=ctx.now,
    )

    await live_feed_manager.broadcast_tap(resp.model_dump(mode="json"))
    if admin_notified:
        await live_feed_manager.broadcast_event("admin_notification", {"member_code": resp.member_code})
    return resp


async def _handle_pairing_tap(ctx: _TapContext) -> Optional[TapVerificationResponse]:
    """
    Edge Case #4: Intercept Tap if Smart Pairing Mode is Active!
    Returns the pairing response, or None when the normal check-in flow should continue.
    """
    db, now, uid_masked = ctx.db, ctx.now, ctx.uid_masked

    runtime_state.clear_if_expired(now)
    if runtime_state.pairing_member_id is None:
        return None

    target_member = await db.get(Member, runtime_state.pairing_member_id)
    if not target_member:
        return None

    try:
        paired_card = await bind_card_to_member(
            db,
            member=target_member,
            raw_uid=ctx.raw_uid,
            card_label=runtime_state.pairing_card_label,
            actor_user_id=runtime_state.pairing_actor_id or (ctx.actor_user.id if ctx.actor_user else None),
            now=now,
        )
    except HTTPException as conflict_exc:
        # Card already belongs to someone else — keep Pairing Mode open & notify staff!
        await live_feed_manager.broadcast_event(
            "pairing_conflict",
            {
                "member_id": target_member.id,
                "card_uid_masked": uid_masked,
                "message": str(conflict_exc.detail),
            },
        )
        raise conflict_exc

    await record_audit_log(
        db,
        action="KEYCARD_PAIRED_VIA_PHONE_TAP",
        actor=ctx.actor_user,
        target_type="member",
        target_id=target_member.id,
        details=f"Paired NFC card {uid_masked} to {target_member.member_code} via Smart Pairing Mode",
        request=ctx.request,
    )
    latency_ms = max(1, int(round((time.perf_counter() - ctx.started_at) * 1000)))
    db.add(
        KeycardTapLog(
            keycard_id=paired_card.id,
            member_id=target_member.id,
            scanner_id=ctx.scanner.id if ctx.scanner else None,
            visit_id=None,
            card_uid_masked=uid_masked,
            decision=TapDecision.PAIRED_CARD,
            reason_message=f"NFC Card ({uid_masked}) paired to {target_member.full_name} ({target_member.member_code})!",
            latency_ms=latency_ms,
            tapped_at=now,
        )
    )
    await db.commit()
    await db.refresh(paired_card)

    # Turn off Pairing Mode immediately after successful bind
    runtime_state.clear_pairing()
    await live_feed_manager.broadcast_event(
        "pairing_mode_changed",
        runtime_state.to_pairing_status(now).model_dump(mode="json"),
    )
    await live_feed_manager.broadcast_event(
        "keycard_paired",
        {
            "member_id": target_member.id,
            "member_code": target_member.member_code,
            "member_name": target_member.full_name,
            "card_id": paired_card.id,
            "card_uid": normalize_card_uid(ctx.raw_uid),
            "card_uid_masked": paired_card.card_uid_masked,
            "card_label": paired_card.card_label,
        },
    )

    resp_pair = TapVerificationResponse(
        granted=True,
        decision=TapDecision.PAIRED_CARD,
        reason_message=f"Successfully paired NFC Card ({uid_masked}) to {target_member.full_name} ({target_member.member_code})!",
        privacy_safe_message=f"Card Paired to {target_member.first_name}!",
        card_uid_masked=uid_masked,
        member_id=target_member.id,
        member_code=target_member.member_code,
        member_name=target_member.full_name,
        member_status=target_member.status.value if hasattr(target_member.status, "value") else str(target_member.status),
        latency_ms=latency_ms,
        tapped_at=now,
    )
    await live_feed_manager.broadcast_tap(resp_pair.model_dump(mode="json"))
    return resp_pair


async def _check_card_and_member_status(
    ctx: _TapContext,
    keycard: MemberKeycard,
    member: Member,
) -> Optional[TapVerificationResponse]:
    """Steps 2–3: reject lost/stolen/revoked cards and inactive or suspended member profiles."""
    uid_masked = ctx.uid_masked

    # ── Step 2: Keycard Status Check (Lost / Stolen / Revoked) ───────────────
    if keycard.status in (KeycardStatus.LOST, KeycardStatus.STOLEN):
        await record_audit_log(
            ctx.db,
            action="KEYCARD_LOST_STOLEN_TAP_ATTEMPT",
            actor=ctx.actor_user,
            target_type="member_keycard",
            target_id=keycard.id,
            outcome="DENIED",
            details=f"Flagged {keycard.status.value} card ({uid_masked}) tapped for {member.member_code}",
            request=ctx.request,
        )
        return await _finalize_tap(
            ctx,
            granted=False,
            decision=TapDecision.DENIED_CARD_LOST_OR_STOLEN,
            reason_message=(
                f"SECURITY ALERT: This keycard is marked {keycard.status.value.upper()} "
                f"for {member.full_name} ({member.member_code}). Verify member ID."
            ),
            privacy_safe_message="Card Deactivated — Please See Front Desk",
            member_obj=member,
        )

    if keycard.status != KeycardStatus.ACTIVE:
        return await _finalize_tap(
            ctx,
            granted=False,
            decision=TapDecision.DENIED_CARD_REVOKED,
            reason_message=f"This keycard has been {keycard.status.value}. Please tap the member's active card.",
            privacy_safe_message="Card Inactive — Please See Front Desk",
            member_obj=member,
        )

    # ── Step 3: Member Profile Status Check ──────────────────────────────────
    if not member.is_active or member.status == MemberStatus.INACTIVE:
        return await _finalize_tap(
            ctx,
            granted=False,
            decision=TapDecision.DENIED_MEMBER_INACTIVE,
            reason_message=f"Member profile ({member.member_code}) is currently deactivated.",
            privacy_safe_message="Account Inactive — Please See Front Desk",
            member_obj=member,
        )

    if member.status == MemberStatus.SUSPENDED:
        return await _finalize_tap(
            ctx,
            granted=False,
            decision=TapDecision.DENIED_MEMBER_SUSPENDED,
            reason_message=f"Access blocked: {member.full_name} ({member.member_code}) is suspended.",
            privacy_safe_message="Access Restricted — Please See Front Desk",
            member_obj=member,
        )

    return None


def _classify_memberships(
    member: Member,
    now: datetime,
) -> Tuple[List[MemberMembership], List[MemberMembership], List[MemberMembership]]:
    """
    Step 4 (PH End-of-Day Aware): split memberships into (valid_active, pending, expired).
    Active rows that are past their effective end are flipped to EXPIRED as a side effect.
    """
    valid_active: List[MemberMembership] = []
    pending: List[MemberMembership] = []
    expired: List[MemberMembership] = []

    for ms in member.memberships:
        start_dt = _ensure_utc(ms.start_date)
        effective_end_dt = _membership_effective_end_utc(ms.end_date)

        if ms.status == MembershipStatus.ACTIVE:
            if effective_end_dt < now:
                ms.status = MembershipStatus.EXPIRED
                expired.append(ms)
            elif start_dt <= now <= effective_end_dt:
                valid_active.append(ms)
        elif ms.status == MembershipStatus.PENDING:
            pending.append(ms)
        elif ms.status == MembershipStatus.EXPIRED:
            expired.append(ms)

    return valid_active, pending, expired


async def _deny_without_active_membership(
    ctx: _TapContext,
    member: Member,
    pending: List[MemberMembership],
    expired: List[MemberMembership],
) -> TapVerificationResponse:
    """Step 4 denial: payment pending, expired, or no membership at all."""
    if expired and member.status == MemberStatus.ACTIVE:
        member.status = MemberStatus.EXPIRED

    if pending:
        pending_ms = sorted(pending, key=lambda m: _ensure_utc(m.created_at), reverse=True)[0]
        p_name = pending_ms.plan.name if pending_ms.plan else "Pending Plan"
        return await _finalize_tap(
            ctx,
            granted=False,
            decision=TapDecision.DENIED_PAYMENT_PENDING,
            reason_message=f"Membership payment for '{p_name}' is pending confirmation. Settle payment to activate entry.",
            privacy_safe_message="Payment Pending — Please See Front Desk",
            member_obj=member,
            plan_name=p_name,
        )

    if expired:
        latest_exp = sorted(expired, key=lambda m: _ensure_utc(m.end_date), reverse=True)[0]
        p_name = latest_exp.plan.name if latest_exp.plan else "Expired Plan"
        exp_dt = _ensure_utc(latest_exp.end_date)
        return await _finalize_tap(
            ctx,
            granted=False,
            decision=TapDecision.DENIED_MEMBERSHIP_EXPIRED,
            reason_message=f"Membership ({p_name}) expired on {to_ph_time(exp_dt).strftime('%b %d, %Y')}. Please renew plan.",
            privacy_safe_message="Membership Expired — Please Renew at Front Desk",
            member_obj=member,
            plan_name=p_name,
            membership_end_date=exp_dt,
            days_remaining=0,
        )

    return await _finalize_tap(
        ctx,
        granted=False,
        decision=TapDecision.DENIED_NO_MEMBERSHIP,
        reason_message="No active membership plan found for this member.",
        privacy_safe_message="No Active Membership — Please See Front Desk",
        member_obj=member,
    )


def _summarize_active_plan(valid_active: List[MemberMembership], now: datetime) -> _ActivePlan:
    active_ms = sorted(valid_active, key=lambda m: _ensure_utc(m.end_date), reverse=True)[0]
    active_end_dt = _membership_effective_end_utc(active_ms.end_date)
    plan_name = active_ms.plan.name if active_ms.plan else "Active Plan"
    seconds_left = max(0.0, (active_end_dt - now).total_seconds())
    days_remaining = int(math.ceil(seconds_left / 86400.0))

    warning_banner: Optional[str] = None
    if days_remaining <= EXPIRING_SOON_DAYS:
        if days_remaining <= 1:
            warning_banner = f"Expiring today ({plan_name}) — remind member to renew!"
        else:
            warning_banner = f"Expiring soon: {days_remaining} days remaining on {plan_name}"

    return _ActivePlan(
        plan_name=plan_name,
        end_dt=active_end_dt,
        days_remaining=days_remaining,
        warning_banner=warning_banner,
    )


async def _apply_cooldown_or_checkout(
    ctx: _TapContext,
    member: Member,
    plan: _ActivePlan,
) -> Optional[TapVerificationResponse]:
    """
    Step 5: 10-Min Check-In Cooldown & 5-Min Post-Checkout Cooldown.
    Returns a response when the tap is a duplicate or a check-out, else None to continue to check-in.
    """
    now = ctx.now
    checkin_cd = STANDARD_CHECKIN_COOLDOWN_SECS
    post_out_cd = STANDARD_POST_CHECKOUT_COOLDOWN_SECS

    last_visit_stmt = (
        select(Visit)
        .where(Visit.member_id == member.id)
        .order_by(desc(Visit.checked_in_at))
        .limit(1)
    )
    last_visit = (await ctx.db.execute(last_visit_stmt)).scalar_one_or_none()
    if not last_visit:
        return None

    last_in = _ensure_utc(last_visit.checked_in_at)
    last_out = _ensure_utc(last_visit.checked_out_at) if last_visit.checked_out_at else None
    plan_fields = plan.response_fields()

    # Case A: Member is CURRENTLY INSIDE (open visit today)
    if last_out is None:
        elapsed_in_secs = (now - last_in).total_seconds()
        checkin_time_str = _fmt_ph_clock(last_in)

        if 0 <= elapsed_in_secs < checkin_cd:
            remaining_cd = max(1, int(checkin_cd - elapsed_in_secs))
            rem_label = (
                f"{math.ceil(remaining_cd / 60)} min(s)"
                if remaining_cd >= 60
                else f"{remaining_cd}s"
            )
            return await _finalize_tap(
                ctx,
                granted=True,
                decision=TapDecision.ALREADY_CHECKED_IN,
                reason_message=(
                    f"Already checked in since {checkin_time_str} (no duplicate logged). "
                    f"Check-out tap unlocks in {rem_label}."
                ),
                privacy_safe_message=f"Already Checked In ({checkin_time_str}) — Enjoy Your Workout!",
                member_obj=member,
                visit_obj=last_visit,
                **plan_fields,
            )

        # Elapsed > Check-In Cooldown -> Log Check-Out!
        tap_mode = ctx.scanner.tap_mode if ctx.scanner else ScannerTapMode.TOGGLE_IN_OUT
        if tap_mode == ScannerTapMode.TOGGLE_IN_OUT:
            last_visit.checked_out_at = now
            duration_mins = max(1, int(round((now - last_in).total_seconds() / 60.0)))
            checkout_time_str = _fmt_ph_clock(now)
            await ctx.db.flush()
            return await _finalize_tap(
                ctx,
                granted=True,
                decision=TapDecision.GRANTED_CHECK_OUT,
                reason_message=f"Checked out at {checkout_time_str} after {duration_mins} min workout session.",
                privacy_safe_message=f"Goodbye, {member.first_name}! Checked Out ({duration_mins} mins)",
                member_obj=member,
                visit_obj=last_visit,
                **plan_fields,
            )
        return None

    # Case B: Member JUST CHECKED OUT (< Post-Checkout Cooldown) -> Prevent accidental re-entry!
    elapsed_out_secs = (now - last_out).total_seconds()
    if 0 <= elapsed_out_secs < post_out_cd:
        checkout_time_str = _fmt_ph_clock(last_out)
        return await _finalize_tap(
            ctx,
            granted=True,
            decision=TapDecision.ALREADY_CHECKED_OUT,
            reason_message=f"Already checked out at {checkout_time_str} (duplicate exit tap ignored).",
            privacy_safe_message=f"Already Checked Out ({checkout_time_str}) — Take Care!",
            member_obj=member,
            visit_obj=last_visit,
            **plan_fields,
        )
    return None


async def _create_check_in(
    ctx: _TapContext,
    member: Member,
    plan: _ActivePlan,
) -> TapVerificationResponse:
    """Step 6: Create Automatic Check-In Visit + Notify Admin."""
    db, now = ctx.db, ctx.now
    keycard = ctx.keycard

    inferred_type = await _infer_visit_type_and_notify_trainer(db, member, now)
    new_visit = Visit(
        member_id=member.id,
        recorded_by_user_id=ctx.actor_user.id if ctx.actor_user else None,
        keycard_id=keycard.id,
        scanner_id=ctx.scanner.id if ctx.scanner else None,
        checked_in_at=now,
        visit_type=inferred_type,
        entry_method=EntryMethod.RFID_TAP,
        notes=f"Auto check-in via NFC Smart Keycard ({ctx.uid_masked})",
    )
    db.add(new_visit)
    await db.flush()

    await notify_admins_on_checkin(
        db,
        member=member,
        plan_name=plan.plan_name,
        method_label="NFC Smart Keycard",
        checkin_utc=now,
    )

    checkin_time_str = _fmt_ph_clock(now)
    return await _finalize_tap(
        ctx,
        granted=True,
        decision=TapDecision.GRANTED_CHECK_IN,
        reason_message=(
            f"Access granted! Checked in at {checkin_time_str} for "
            f"{inferred_type.value.replace('_', ' ').title()}."
        ),
        privacy_safe_message=f"Welcome, {member.first_name}! Checked In ({checkin_time_str})",
        member_obj=member,
        visit_obj=new_visit,
        admin_notified=True,
        **plan.response_fields(),
    )


async def process_card_tap(
    *,
    raw_uid: str,
    scanner_id: Optional[int],
    request: Request,
    actor_user: Optional[User],
    scanner: Optional[AccessScanner],
    db: AsyncSession,
) -> TapVerificationResponse:
    started_at = time.perf_counter()
    now = datetime.now(timezone.utc)

    # First catch up any unclosed visits past gym closing time (11 PM Mon–Sat, 10 PM Sun)
    await sweep_overdue_open_visits(db)

    if scanner is None and scanner_id:
        candidate = await db.get(AccessScanner, scanner_id)
        if candidate and candidate.is_active:
            scanner = candidate

    ctx = _TapContext(
        db=db,
        request=request,
        actor_user=actor_user,
        scanner=scanner,
        raw_uid=raw_uid,
        uid_masked=mask_card_uid(raw_uid),
        now=now,
        started_at=started_at,
    )

    # ── Edge Case #4: Intercept Tap if Smart Pairing Mode is Active! ─────────
    paired = await _handle_pairing_tap(ctx)
    if paired is not None:
        return paired

    # ── Normal Check-In / Check-Out Lookup ───────────────────────────────────
    stmt = (
        select(MemberKeycard)
        .where(MemberKeycard.card_uid_hash == hash_card_uid(raw_uid))
        .options(
            selectinload(MemberKeycard.member)
            .selectinload(Member.memberships)
            .selectinload(MemberMembership.plan)
        )
    )
    keycard = (await db.execute(stmt)).scalar_one_or_none()
    ctx.keycard = keycard

    # ── Step 1: Unregistered Card Check ──────────────────────────────────────
    if not keycard or not keycard.member:
        return await _finalize_tap(
            ctx,
            granted=False,
            decision=TapDecision.DENIED_UNREGISTERED_CARD,
            reason_message="Unregistered NFC keycard. Open a member's profile and click 'Pair Keycard' to assign this card.",
            privacy_safe_message="Card Not Recognized — Please See Front Desk",
        )

    member = keycard.member
    keycard.last_tapped_at = now

    # ── Steps 2–3: Keycard & Member Profile Status ───────────────────────────
    denied = await _check_card_and_member_status(ctx, keycard, member)
    if denied is not None:
        return denied

    # ── Step 4: Active Membership Verification (PH End-of-Day Aware) ─────────
    valid_active, pending, expired = _classify_memberships(member, now)
    if not valid_active:
        return await _deny_without_active_membership(ctx, member, pending, expired)

    plan = _summarize_active_plan(valid_active, now)
    if member.status == MemberStatus.EXPIRED:
        member.status = MemberStatus.ACTIVE

    # ── Step 5: 10-Min Check-In Cooldown & 5-Min Post-Checkout Cooldown ──────
    early_response = await _apply_cooldown_or_checkout(ctx, member, plan)
    if early_response is not None:
        return early_response

    # ── Step 6: Create Automatic Check-In Visit + Notify Admin ───────────────
    return await _create_check_in(ctx, member, plan)
