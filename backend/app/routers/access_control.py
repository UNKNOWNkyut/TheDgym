import asyncio
import logging
import math
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import extract_token_from_request, require_roles
from app.core.rate_limit import require_rate_limit
from app.core.security import decode_access_token
from app.database import AsyncSessionLocal, get_db
from app.models.access_scanner import AccessScanner, ScannerTapMode, hash_scanner_api_key
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
from app.models.user import User, UserRole
from app.models.visit import EntryMethod, Visit, VisitType
from app.schemas.access_control import (
    AccessControlSettings,
    AccessControlSettingsUpdate,
    AccessScannerCreate,
    AccessScannerProvisionResponse,
    AccessScannerResponse,
    KeycardPairRequest,
    KeycardStatusUpdate,
    KeycardTapLogResponse,
    MemberKeycardResponse,
    PairingSessionRequest,
    PairingSessionStatus,
    SimulatorPresetItem,
    TapVerificationResponse,
    TapVerifyRequest,
)
from app.services.audit import record_audit_log
from app.services.visit_sweeper import (
    PH_TZ,
    notify_admins_on_checkin,
    sweep_overdue_open_visits,
    to_ph_time,
)

logger = logging.getLogger("dgym.access_control")

router = APIRouter(prefix="/api", tags=["Smart Keycard Access Control"])

# Standard Production Cooldowns (10 min Check-In -> Check-Out guard, 5 min Post-Checkout guard)
STANDARD_CHECKIN_COOLDOWN_SECS = 10 * 60
STANDARD_POST_CHECKOUT_COOLDOWN_SECS = 5 * 60

# Presentation / Live Defense Fast Cooldowns (optional toggle)
DEMO_CHECKIN_COOLDOWN_SECS = 15
DEMO_POST_CHECKOUT_COOLDOWN_SECS = 10

EXPIRING_SOON_DAYS = 5
PAIRING_MODE_TTL_SECS = 90

rate_limit_tap = require_rate_limit("rfid_tap", max_requests=120, window_seconds=60)


# ──────────────────────────────────────────────────────────────────────────────
# Runtime Settings & Smart Pairing Session State
# ──────────────────────────────────────────────────────────────────────────────

class AccessRuntimeState:
    def __init__(self) -> None:
        self.demo_fast_cooldown: bool = False
        self.pairing_member_id: Optional[int] = None
        self.pairing_member_code: Optional[str] = None
        self.pairing_member_name: Optional[str] = None
        self.pairing_card_label: str = "Primary PVC Keycard"
        self.pairing_actor_id: Optional[int] = None
        self.pairing_expires_at: Optional[datetime] = None

    @property
    def checkin_cooldown_seconds(self) -> int:
        return DEMO_CHECKIN_COOLDOWN_SECS if self.demo_fast_cooldown else STANDARD_CHECKIN_COOLDOWN_SECS

    @property
    def post_checkout_cooldown_seconds(self) -> int:
        return (
            DEMO_POST_CHECKOUT_COOLDOWN_SECS
            if self.demo_fast_cooldown
            else STANDARD_POST_CHECKOUT_COOLDOWN_SECS
        )

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


# ──────────────────────────────────────────────────────────────────────────────
# Helper: Dual Auth (Staff JWT OR Hardware X-Scanner-API-Key)
# ──────────────────────────────────────────────────────────────────────────────

async def authenticate_tap_caller(
    request: Request,
    x_scanner_api_key: Optional[str] = Header(default=None, alias="X-Scanner-API-Key"),
    api_key_query: Optional[str] = Query(default=None, alias="api_key"),
    access_token_cookie: Optional[str] = Cookie(default=None, alias="access_token"),
    db: AsyncSession = Depends(get_db),
) -> Tuple[Optional[User], Optional[AccessScanner]]:
    scanner_key = x_scanner_api_key or api_key_query
    if scanner_key:
        key_hash = hash_scanner_api_key(scanner_key)
        stmt = select(AccessScanner).where(
            AccessScanner.api_key_hash == key_hash,
            AccessScanner.is_active.is_(True),
        )
        scanner = (await db.execute(stmt)).scalar_one_or_none()
        if not scanner:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or deactivated X-Scanner-API-Key.",
            )
        scanner.last_heartbeat_at = datetime.now(timezone.utc)
        return None, scanner

    token = extract_token_from_request(request, None, access_token_cookie)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required (Staff session or X-Scanner-API-Key).",
        )

    payload = decode_access_token(token)
    if not payload or payload.get("sub") is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        )

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found.")

    if user.role not in (UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin, Staff, or Trainer terminals can process keycard taps.",
        )

    return user, None


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


async def _bind_card_to_member(
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
# 0. Access Settings & Smart Pairing Mode Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/access/settings", response_model=AccessControlSettings)
async def get_access_settings(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    return AccessControlSettings(
        demo_fast_cooldown=runtime_state.demo_fast_cooldown,
        checkin_cooldown_seconds=runtime_state.checkin_cooldown_seconds,
        post_checkout_cooldown_seconds=runtime_state.post_checkout_cooldown_seconds,
        weekday_sat_hours="Mon–Sat: 6:00 AM – 11:00 PM",
        sunday_hours="Sun: 2:00 PM – 10:00 PM",
    )


@router.post("/access/settings", response_model=AccessControlSettings)
async def update_access_settings(
    payload: AccessControlSettingsUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    runtime_state.demo_fast_cooldown = payload.demo_fast_cooldown
    updated = AccessControlSettings(
        demo_fast_cooldown=runtime_state.demo_fast_cooldown,
        checkin_cooldown_seconds=runtime_state.checkin_cooldown_seconds,
        post_checkout_cooldown_seconds=runtime_state.post_checkout_cooldown_seconds,
        weekday_sat_hours="Mon–Sat: 6:00 AM – 11:00 PM",
        sunday_hours="Sun: 2:00 PM – 10:00 PM",
    )
    await live_feed_manager.broadcast_event("access_settings_changed", updated.model_dump(mode="json"))
    return updated


@router.get("/access/pairing-session", response_model=PairingSessionStatus)
async def get_pairing_session_status(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    return runtime_state.to_pairing_status()


@router.post("/access/pairing-session", response_model=PairingSessionStatus)
async def start_pairing_session(
    payload: PairingSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    member = await db.get(Member, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    now = datetime.now(timezone.utc)
    runtime_state.pairing_member_id = member.id
    runtime_state.pairing_member_code = member.member_code
    runtime_state.pairing_member_name = member.full_name
    runtime_state.pairing_card_label = payload.card_label
    runtime_state.pairing_actor_id = current_user.id
    runtime_state.pairing_expires_at = now + timedelta(seconds=PAIRING_MODE_TTL_SECS)

    status_obj = runtime_state.to_pairing_status(now)
    await live_feed_manager.broadcast_event("pairing_mode_changed", status_obj.model_dump(mode="json"))
    return status_obj


@router.delete("/access/pairing-session", response_model=PairingSessionStatus)
async def cancel_pairing_session(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    runtime_state.clear_pairing()
    status_obj = runtime_state.to_pairing_status()
    await live_feed_manager.broadcast_event("pairing_mode_changed", status_obj.model_dump(mode="json"))
    return status_obj


# ──────────────────────────────────────────────────────────────────────────────
# 1. Core Automatic Tap Verification & Log Pipeline
# ──────────────────────────────────────────────────────────────────────────────

async def _process_card_tap_core(
    *,
    raw_uid: str,
    scanner_id: Optional[int],
    request: Request,
    actor_user: Optional[User],
    scanner: Optional[AccessScanner],
    db: AsyncSession,
) -> TapVerificationResponse:
    t0 = time.perf_counter()
    now = datetime.now(timezone.utc)

    # First catch up any unclosed visits past gym closing time (11 PM Mon–Sat, 10 PM Sun)
    await sweep_overdue_open_visits(db)

    if scanner is None and scanner_id:
        candidate = await db.get(AccessScanner, scanner_id)
        if candidate and candidate.is_active:
            scanner = candidate

    uid_hash = hash_card_uid(raw_uid)
    uid_masked = mask_card_uid(raw_uid)

    # ── Edge Case #4: Intercept Tap if Smart Pairing Mode is Active! ─────────
    runtime_state.clear_if_expired(now)
    if runtime_state.pairing_member_id is not None:
        target_member = await db.get(Member, runtime_state.pairing_member_id)
        if target_member:
            try:
                paired_card = await _bind_card_to_member(
                    db,
                    member=target_member,
                    raw_uid=raw_uid,
                    card_label=runtime_state.pairing_card_label,
                    actor_user_id=runtime_state.pairing_actor_id or (actor_user.id if actor_user else None),
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
                actor=actor_user,
                target_type="member",
                target_id=target_member.id,
                details=f"Paired NFC card {uid_masked} to {target_member.member_code} via Smart Pairing Mode",
                request=request,
            )
            latency_ms = max(1, int(round((time.perf_counter() - t0) * 1000)))
            tap_log = KeycardTapLog(
                keycard_id=paired_card.id,
                member_id=target_member.id,
                scanner_id=scanner.id if scanner else None,
                visit_id=None,
                card_uid_masked=uid_masked,
                decision=TapDecision.PAIRED_CARD,
                reason_message=f"NFC Card ({uid_masked}) paired to {target_member.full_name} ({target_member.member_code})!",
                latency_ms=latency_ms,
                tapped_at=now,
            )
            db.add(tap_log)
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
                    "card_uid": normalize_card_uid(raw_uid),
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

    # ── Normal Check-In / Check-Out Lookup ───────────────────────────────────
    stmt = (
        select(MemberKeycard)
        .where(MemberKeycard.card_uid_hash == uid_hash)
        .options(
            selectinload(MemberKeycard.member)
            .selectinload(Member.memberships)
            .selectinload(MemberMembership.plan)
        )
    )
    keycard = (await db.execute(stmt)).scalar_one_or_none()

    async def _finalize(
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
        latency_ms = max(1, int(round((time.perf_counter() - t0) * 1000)))
        tap_log = KeycardTapLog(
            keycard_id=keycard.id if keycard else None,
            member_id=member_obj.id if member_obj else None,
            scanner_id=scanner.id if scanner else None,
            visit_id=visit_obj.id if visit_obj else None,
            card_uid_masked=uid_masked,
            decision=decision,
            reason_message=reason_message,
            plan_name=plan_name,
            days_remaining=days_remaining,
            warning_banner=warning_banner,
            latency_ms=latency_ms,
            tapped_at=now,
        )
        db.add(tap_log)
        await db.commit()

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
            card_uid_masked=uid_masked,
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
            tapped_at=now,
        )

        await live_feed_manager.broadcast_tap(resp.model_dump(mode="json"))
        if admin_notified:
            await live_feed_manager.broadcast_event("admin_notification", {"member_code": resp.member_code})
        return resp

    # ── Step 1: Unregistered Card Check ──────────────────────────────────────
    if not keycard or not keycard.member:
        return await _finalize(
            granted=False,
            decision=TapDecision.DENIED_UNREGISTERED_CARD,
            reason_message="Unregistered NFC keycard. Open a member's profile and click 'Pair Keycard' to assign this card.",
            privacy_safe_message="Card Not Recognized — Please See Front Desk",
        )

    member = keycard.member
    keycard.last_tapped_at = now

    # ── Step 2: Keycard Status Check (Lost / Stolen / Revoked) ───────────────
    if keycard.status in (KeycardStatus.LOST, KeycardStatus.STOLEN):
        await record_audit_log(
            db,
            action="KEYCARD_LOST_STOLEN_TAP_ATTEMPT",
            actor=actor_user,
            target_type="member_keycard",
            target_id=keycard.id,
            outcome="DENIED",
            details=f"Flagged {keycard.status.value} card ({uid_masked}) tapped for {member.member_code}",
            request=request,
        )
        return await _finalize(
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
        return await _finalize(
            granted=False,
            decision=TapDecision.DENIED_CARD_REVOKED,
            reason_message=f"This keycard has been {keycard.status.value}. Please tap the member's active card.",
            privacy_safe_message="Card Inactive — Please See Front Desk",
            member_obj=member,
        )

    # ── Step 3: Member Profile Status Check ──────────────────────────────────
    if not member.is_active or member.status == MemberStatus.INACTIVE:
        return await _finalize(
            granted=False,
            decision=TapDecision.DENIED_MEMBER_INACTIVE,
            reason_message=f"Member profile ({member.member_code}) is currently deactivated.",
            privacy_safe_message="Account Inactive — Please See Front Desk",
            member_obj=member,
        )

    if member.status == MemberStatus.SUSPENDED:
        return await _finalize(
            granted=False,
            decision=TapDecision.DENIED_MEMBER_SUSPENDED,
            reason_message=f"Access blocked: {member.full_name} ({member.member_code}) is suspended.",
            privacy_safe_message="Access Restricted — Please See Front Desk",
            member_obj=member,
        )

    # ── Step 4: Active Membership Verification (PH End-of-Day Aware) ─────────
    valid_active_memberships: List[MemberMembership] = []
    pending_memberships: List[MemberMembership] = []
    expired_memberships: List[MemberMembership] = []

    for ms in member.memberships:
        start_dt = _ensure_utc(ms.start_date)
        effective_end_dt = _membership_effective_end_utc(ms.end_date)

        if ms.status == MembershipStatus.ACTIVE:
            if effective_end_dt < now:
                ms.status = MembershipStatus.EXPIRED
                expired_memberships.append(ms)
            elif start_dt <= now <= effective_end_dt:
                valid_active_memberships.append(ms)
        elif ms.status == MembershipStatus.PENDING:
            pending_memberships.append(ms)
        elif ms.status == MembershipStatus.EXPIRED:
            expired_memberships.append(ms)

    if not valid_active_memberships:
        if expired_memberships and member.status == MemberStatus.ACTIVE:
            member.status = MemberStatus.EXPIRED

        if pending_memberships:
            pending_ms = sorted(pending_memberships, key=lambda m: _ensure_utc(m.created_at), reverse=True)[0]
            p_name = pending_ms.plan.name if pending_ms.plan else "Pending Plan"
            return await _finalize(
                granted=False,
                decision=TapDecision.DENIED_PAYMENT_PENDING,
                reason_message=f"Membership payment for '{p_name}' is pending confirmation. Settle payment to activate entry.",
                privacy_safe_message="Payment Pending — Please See Front Desk",
                member_obj=member,
                plan_name=p_name,
            )

        if expired_memberships:
            latest_exp = sorted(expired_memberships, key=lambda m: _ensure_utc(m.end_date), reverse=True)[0]
            p_name = latest_exp.plan.name if latest_exp.plan else "Expired Plan"
            exp_dt = _ensure_utc(latest_exp.end_date)
            return await _finalize(
                granted=False,
                decision=TapDecision.DENIED_MEMBERSHIP_EXPIRED,
                reason_message=f"Membership ({p_name}) expired on {to_ph_time(exp_dt).strftime('%b %d, %Y')}. Please renew plan.",
                privacy_safe_message="Membership Expired — Please Renew at Front Desk",
                member_obj=member,
                plan_name=p_name,
                membership_end_date=exp_dt,
                days_remaining=0,
            )

        return await _finalize(
            granted=False,
            decision=TapDecision.DENIED_NO_MEMBERSHIP,
            reason_message="No active membership plan found for this member.",
            privacy_safe_message="No Active Membership — Please See Front Desk",
            member_obj=member,
        )

    active_ms = sorted(valid_active_memberships, key=lambda m: _ensure_utc(m.end_date), reverse=True)[0]
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

    if member.status == MemberStatus.EXPIRED:
        member.status = MemberStatus.ACTIVE

    # ── Step 5: 10-Min Check-In Cooldown & 5-Min Post-Checkout Cooldown ──────
    checkin_cd = runtime_state.checkin_cooldown_seconds
    post_out_cd = runtime_state.post_checkout_cooldown_seconds

    last_visit_stmt = (
        select(Visit)
        .where(Visit.member_id == member.id)
        .order_by(desc(Visit.checked_in_at))
        .limit(1)
    )
    last_visit = (await db.execute(last_visit_stmt)).scalar_one_or_none()

    if last_visit:
        last_in = _ensure_utc(last_visit.checked_in_at)
        last_out = _ensure_utc(last_visit.checked_out_at) if last_visit.checked_out_at else None

        # Case A: Member is CURRENTLY INSIDE (open visit today)
        if last_out is None:
            elapsed_in_secs = (now - last_in).total_seconds()
            checkin_time_str = to_ph_time(last_in).strftime("%I:%M %p").lstrip("0")

            if 0 <= elapsed_in_secs < checkin_cd:
                remaining_cd = max(1, int(checkin_cd - elapsed_in_secs))
                rem_label = (
                    f"{math.ceil(remaining_cd / 60)} min(s)"
                    if remaining_cd >= 60
                    else f"{remaining_cd}s"
                )
                return await _finalize(
                    granted=True,
                    decision=TapDecision.ALREADY_CHECKED_IN,
                    reason_message=(
                        f"Already checked in since {checkin_time_str} (no duplicate logged). "
                        f"Check-out tap unlocks in {rem_label}."
                    ),
                    privacy_safe_message=f"Already Checked In ({checkin_time_str}) — Enjoy Your Workout!",
                    member_obj=member,
                    plan_name=plan_name,
                    membership_end_date=active_end_dt,
                    days_remaining=days_remaining,
                    warning_banner=warning_banner,
                    visit_obj=last_visit,
                )

            # Elapsed > Check-In Cooldown -> Log Check-Out!
            tap_mode = scanner.tap_mode if scanner else ScannerTapMode.TOGGLE_IN_OUT
            if tap_mode == ScannerTapMode.TOGGLE_IN_OUT:
                last_visit.checked_out_at = now
                duration_mins = max(1, int(round((now - last_in).total_seconds() / 60.0)))
                checkout_time_str = to_ph_time(now).strftime("%I:%M %p").lstrip("0")
                await db.flush()
                return await _finalize(
                    granted=True,
                    decision=TapDecision.GRANTED_CHECK_OUT,
                    reason_message=(
                        f"Checked out at {checkout_time_str} after {duration_mins} min workout session."
                    ),
                    privacy_safe_message=f"Goodbye, {member.first_name}! Checked Out ({duration_mins} mins)",
                    member_obj=member,
                    plan_name=plan_name,
                    membership_end_date=active_end_dt,
                    days_remaining=days_remaining,
                    warning_banner=warning_banner,
                    visit_obj=last_visit,
                )

        # Case B: Member JUST CHECKED OUT (< Post-Checkout Cooldown) -> Prevent accidental re-entry!
        else:
            elapsed_out_secs = (now - last_out).total_seconds()
            if 0 <= elapsed_out_secs < post_out_cd:
                checkout_time_str = to_ph_time(last_out).strftime("%I:%M %p").lstrip("0")
                return await _finalize(
                    granted=True,
                    decision=TapDecision.ALREADY_CHECKED_OUT,
                    reason_message=(
                        f"Already checked out at {checkout_time_str} (duplicate exit tap ignored)."
                    ),
                    privacy_safe_message=f"Already Checked Out ({checkout_time_str}) — Take Care!",
                    member_obj=member,
                    plan_name=plan_name,
                    membership_end_date=active_end_dt,
                    days_remaining=days_remaining,
                    warning_banner=warning_banner,
                    visit_obj=last_visit,
                )

    # ── Step 6: Create Automatic Check-In Visit + Notify Admin ───────────────
    inferred_type = await _infer_visit_type_and_notify_trainer(db, member, now)
    new_visit = Visit(
        member_id=member.id,
        recorded_by_user_id=actor_user.id if actor_user else None,
        keycard_id=keycard.id,
        scanner_id=scanner.id if scanner else None,
        checked_in_at=now,
        visit_type=inferred_type,
        entry_method=EntryMethod.RFID_TAP,
        notes=f"Auto check-in via NFC Smart Keycard ({uid_masked})",
    )
    db.add(new_visit)
    await db.flush()

    await notify_admins_on_checkin(
        db,
        member=member,
        plan_name=plan_name,
        method_label="NFC Smart Keycard",
        checkin_utc=now,
    )

    checkin_time_str = to_ph_time(now).strftime("%I:%M %p").lstrip("0")
    return await _finalize(
        granted=True,
        decision=TapDecision.GRANTED_CHECK_IN,
        reason_message=(
            f"Access granted! Checked in at {checkin_time_str} for "
            f"{inferred_type.value.replace('_', ' ').title()}."
        ),
        privacy_safe_message=f"Welcome, {member.first_name}! Checked In ({checkin_time_str})",
        member_obj=member,
        plan_name=plan_name,
        membership_end_date=active_end_dt,
        days_remaining=days_remaining,
        warning_banner=warning_banner,
        visit_obj=new_visit,
        admin_notified=True,
    )


@router.post(
    "/access/tap",
    response_model=TapVerificationResponse,
    dependencies=[Depends(rate_limit_tap)],
    summary="Verify smart keycard tap and automatically log check-in, check-out, or pairing",
)
async def verify_and_log_keycard_tap(
    payload: TapVerifyRequest,
    request: Request,
    auth_ctx: Tuple[Optional[User], Optional[AccessScanner]] = Depends(authenticate_tap_caller),
    db: AsyncSession = Depends(get_db),
):
    actor_user, scanner = auth_ctx
    return await _process_card_tap_core(
        raw_uid=payload.card_uid,
        scanner_id=payload.scanner_id,
        request=request,
        actor_user=actor_user,
        scanner=scanner,
        db=db,
    )


@router.api_route(
    "/access/webhook-tap",
    methods=["GET", "POST"],
    response_model=TapVerificationResponse,
    dependencies=[Depends(rate_limit_tap)],
    summary="Flexible webhook adapter for 3rd-party Android NFC-to-Web forwarder apps",
)
async def webhook_card_tap(
    request: Request,
    uid: Optional[str] = Query(default=None),
    tag_id: Optional[str] = Query(default=None),
    card_uid: Optional[str] = Query(default=None),
    auth_ctx: Tuple[Optional[User], Optional[AccessScanner]] = Depends(authenticate_tap_caller),
    db: AsyncSession = Depends(get_db),
):
    resolved_uid = uid or tag_id or card_uid
    if not resolved_uid and request.method == "POST":
        try:
            body: Dict[str, Any] = await request.json()
            resolved_uid = (
                body.get("card_uid")
                or body.get("uid")
                or body.get("tag_id")
                or body.get("tag_uid")
                or body.get("serialNumber")
                or body.get("id")
            )
        except Exception:
            pass

    if not resolved_uid or len(normalize_card_uid(str(resolved_uid))) < 4:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing or invalid NFC card UID in webhook payload.",
        )

    actor_user, scanner = auth_ctx
    return await _process_card_tap_core(
        raw_uid=normalize_card_uid(str(resolved_uid)),
        scanner_id=None,
        request=request,
        actor_user=actor_user,
        scanner=scanner,
        db=db,
    )


# ──────────────────────────────────────────────────────────────────────────────
# 2. Real-Time WebSocket Live Feed for Reception & Mobile Scanner Screens
# ──────────────────────────────────────────────────────────────────────────────

@router.websocket("/access/ws/live-feed")
async def websocket_access_live_feed(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    cookie_token = websocket.cookies.get("access_token")
    raw_token = token or cookie_token
    if not raw_token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(raw_token)
    if not payload or payload.get("sub") is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        try:
            user = await db.get(User, int(payload["sub"]))
        except (ValueError, TypeError):
            user = None

        if not user or not user.is_active or user.role not in (
            UserRole.ADMIN,
            UserRole.STAFF,
            UserRole.TRAINER,
        ):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await live_feed_manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "event": "connected",
                "status": "scanner_ready",
                "pairing": runtime_state.to_pairing_status().model_dump(mode="json"),
            }
        )
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await live_feed_manager.disconnect(websocket)


# ──────────────────────────────────────────────────────────────────────────────
# 3. Tap Audit Log History
# ──────────────────────────────────────────────────────────────────────────────

GRANTED_DECISIONS = {
    TapDecision.GRANTED_CHECK_IN,
    TapDecision.GRANTED_CHECK_OUT,
    TapDecision.ALREADY_CHECKED_IN,
    TapDecision.ALREADY_CHECKED_OUT,
    TapDecision.PAIRED_CARD,
}


@router.get(
    "/access/logs",
    response_model=List[KeycardTapLogResponse],
    summary="List recent smart keycard tap events (both granted and denied)",
)
async def list_keycard_tap_logs(
    granted_only: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    stmt = (
        select(KeycardTapLog)
        .options(
            selectinload(KeycardTapLog.member),
            selectinload(KeycardTapLog.scanner),
        )
        .order_by(desc(KeycardTapLog.tapped_at))
        .limit(limit)
    )

    if granted_only is True:
        stmt = stmt.where(KeycardTapLog.decision.in_(list(GRANTED_DECISIONS)))
    elif granted_only is False:
        stmt = stmt.where(KeycardTapLog.decision.notin_(list(GRANTED_DECISIONS)))

    logs = (await db.execute(stmt)).scalars().all()
    results: List[KeycardTapLogResponse] = []
    for item in logs:
        is_granted = item.decision in GRANTED_DECISIONS
        results.append(
            KeycardTapLogResponse(
                id=item.id,
                keycard_id=item.keycard_id,
                member_id=item.member_id,
                member_code=item.member.member_code if item.member else None,
                member_name=item.member.full_name if item.member else None,
                scanner_name=item.scanner.name if item.scanner else "NFC Scanner Terminal",
                visit_id=item.visit_id,
                card_uid_masked=item.card_uid_masked,
                decision=item.decision,
                granted=is_granted,
                reason_message=item.reason_message,
                plan_name=item.plan_name,
                days_remaining=item.days_remaining,
                warning_banner=item.warning_banner,
                latency_ms=item.latency_ms,
                tapped_at=item.tapped_at,
            )
        )
    return results


# ──────────────────────────────────────────────────────────────────────────────
# 4. Member Keycard Pairing, Listing & Revocation
# ──────────────────────────────────────────────────────────────────────────────

@router.get(
    "/members/{member_id}/keycards",
    response_model=List[MemberKeycardResponse],
    summary="List active and historical smart keycards for a member",
)
async def list_member_keycards(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    stmt = (
        select(MemberKeycard)
        .where(MemberKeycard.member_id == member_id)
        .order_by(desc(MemberKeycard.created_at))
    )
    return (await db.execute(stmt)).scalars().all()


@router.post(
    "/members/{member_id}/keycards",
    response_model=MemberKeycardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Pair a smart keycard to a member (auto-revokes any previous active card)",
)
async def pair_member_keycard(
    member_id: int,
    payload: KeycardPairRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    now = datetime.now(timezone.utc)
    card_record = await _bind_card_to_member(
        db,
        member=member,
        raw_uid=payload.card_uid,
        card_label=payload.card_label,
        actor_user_id=current_user.id,
        now=now,
    )

    if runtime_state.pairing_member_id == member_id:
        runtime_state.clear_pairing()
        await live_feed_manager.broadcast_event(
            "pairing_mode_changed",
            runtime_state.to_pairing_status(now).model_dump(mode="json"),
        )

    await record_audit_log(
        db,
        action="KEYCARD_PAIRED",
        actor=current_user,
        target_type="member",
        target_id=member.id,
        details=f"Paired keycard {card_record.card_uid_masked} ({payload.card_label}) to {member.member_code}",
        request=request,
    )
    await db.commit()
    await db.refresh(card_record)
    return card_record


@router.patch(
    "/keycards/{keycard_id}/status",
    response_model=MemberKeycardResponse,
    summary="Update keycard status (e.g. mark lost, stolen, revoked, or reactivate)",
)
async def update_keycard_status(
    keycard_id: int,
    payload: KeycardStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    keycard = await db.get(MemberKeycard, keycard_id)
    if not keycard:
        raise HTTPException(status_code=404, detail="Keycard not found.")

    now = datetime.now(timezone.utc)

    if payload.status == KeycardStatus.ACTIVE and keycard.status != KeycardStatus.ACTIVE:
        other_active_stmt = select(MemberKeycard).where(
            MemberKeycard.member_id == keycard.member_id,
            MemberKeycard.status == KeycardStatus.ACTIVE,
            MemberKeycard.id != keycard.id,
        )
        others = (await db.execute(other_active_stmt)).scalars().all()
        for oc in others:
            oc.status = KeycardStatus.REVOKED
            oc.revoked_at = now
            oc.revoked_reason = "Auto-revoked upon reactivating another keycard"
        keycard.revoked_at = None
        keycard.revoked_reason = None
    elif payload.status != KeycardStatus.ACTIVE:
        keycard.revoked_at = now
        keycard.revoked_reason = payload.reason or f"Marked as {payload.status.value} by staff"

    keycard.status = payload.status
    await record_audit_log(
        db,
        action=f"KEYCARD_STATUS_{payload.status.value.upper()}",
        actor=current_user,
        target_type="member_keycard",
        target_id=keycard.id,
        details=f"Updated card {keycard.card_uid_masked} to {payload.status.value}. Reason: {payload.reason or '-'}",
        request=request,
    )
    await db.commit()
    await db.refresh(keycard)
    return keycard


# ──────────────────────────────────────────────────────────────────────────────
# 5. Hardware Scanner Provisioning & Virtual Simulator Presets
# ──────────────────────────────────────────────────────────────────────────────

@router.get(
    "/access/scanners",
    response_model=List[AccessScannerResponse],
    summary="List registered RFID/NFC scanner terminals",
)
async def list_access_scanners(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    stmt = select(AccessScanner).order_by(AccessScanner.id.asc())
    return (await db.execute(stmt)).scalars().all()


@router.post(
    "/access/scanners",
    response_model=AccessScannerProvisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new hardware scanner and generate its one-time API key",
)
async def create_access_scanner(
    payload: AccessScannerCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    raw_key = f"dgym_scan_{secrets.token_urlsafe(24)}"
    key_hash = hash_scanner_api_key(raw_key)
    prefix = raw_key[:14]

    scanner = AccessScanner(
        name=payload.name,
        location=payload.location,
        tap_mode=payload.tap_mode,
        api_key_hash=key_hash,
        api_key_prefix=prefix,
        is_active=True,
    )
    db.add(scanner)
    await db.flush()

    await record_audit_log(
        db,
        action="SCANNER_PROVISIONED",
        actor=current_user,
        target_type="access_scanner",
        target_id=scanner.id,
        details=f"Provisioned scanner '{scanner.name}' at '{scanner.location}'",
        request=request,
    )
    await db.commit()
    await db.refresh(scanner)

    return AccessScannerProvisionResponse(
        id=scanner.id,
        name=scanner.name,
        location=scanner.location,
        tap_mode=scanner.tap_mode,
        api_key_prefix=prefix,
        raw_api_key=raw_key,
        created_at=scanner.created_at,
    )


@router.get(
    "/access/simulator-presets",
    response_model=List[SimulatorPresetItem],
    summary="Return virtual keycard test presets for QA & hardware-free simulation",
)
async def get_simulator_presets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    async def _member_desc(uid: str, fallback: str) -> str:
        stmt = (
            select(MemberKeycard)
            .where(MemberKeycard.card_uid_hash == hash_card_uid(uid))
            .options(selectinload(MemberKeycard.member))
            .limit(1)
        )
        kc = (await db.execute(stmt)).scalar_one_or_none()
        if kc and kc.member:
            return f"{kc.member.full_name} ({kc.member.member_code})"
        return fallback

    desc_active = await _member_desc("04A1B2C30001", "Active Member")
    desc_exp_soon = await _member_desc("04A1B2C30002", "Expiring Member")
    desc_expired = await _member_desc("04EXPIRED999", "Expired Member")
    desc_lost = await _member_desc("04DEAD990003", "Flagged Member")

    return [
        SimulatorPresetItem(
            id="valid_active",
            label="Active Member (Full Access)",
            description=f"{desc_active} • Active Plan",
            badge_tone="emerald",
            card_uid="04A1B2C30001",
            expected_outcome="GRANTED (Check-In / Toggle Check-Out)",
        ),
        SimulatorPresetItem(
            id="expiring_soon",
            label="Active • Expiring in 3 Days",
            description=f"{desc_exp_soon} • Triggers <= 5 Days Warning",
            badge_tone="amber",
            card_uid="04A1B2C30002",
            expected_outcome="GRANTED + Renewal Reminder Banner",
        ),
        SimulatorPresetItem(
            id="expired_plan",
            label="Expired Membership",
            description=f"{desc_expired} • Plan Past End Date",
            badge_tone="red",
            card_uid="04EXPIRED999",
            expected_outcome="DENIED (Hard-Blocked • Expired)",
        ),
        SimulatorPresetItem(
            id="lost_stolen",
            label="Reported Lost / Stolen Card",
            description=f"{desc_lost} • Flagged Lost Keycard",
            badge_tone="red",
            card_uid="04DEAD990003",
            expected_outcome="DENIED + Security Confiscation Alert",
        ),
        SimulatorPresetItem(
            id="unregistered",
            label="Unknown / Blank Keycard",
            description="Unassigned NFC Card UID (04FF99887766)",
            badge_tone="zinc",
            card_uid="04FF99887766",
            expected_outcome="DENIED (Unregistered Card)",
        ),
    ]
