import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

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
from app.models.access_scanner import AccessScanner, hash_scanner_api_key
from app.models.keycard_tap_log import KeycardTapLog, TapDecision
from app.models.member import Member
from app.models.member_keycard import KeycardStatus, MemberKeycard, normalize_card_uid
from app.models.user import User, UserRole
from app.schemas.access_control import (
    AccessScannerCreate,
    AccessScannerProvisionResponse,
    AccessScannerResponse,
    KeycardPairRequest,
    KeycardStatusUpdate,
    KeycardTapLogResponse,
    MemberKeycardResponse,
    PairingSessionRequest,
    PairingSessionStatus,
    TapVerificationResponse,
    TapVerifyRequest,
)
from app.services.access_service import (
    PAIRING_MODE_TTL_SECS,
    bind_card_to_member,
    live_feed_manager,
    process_card_tap,
    runtime_state,
)
from app.services.audit import record_audit_log

logger = logging.getLogger("dgym.access_control")

router = APIRouter(prefix="/api", tags=["Smart Keycard Access Control"])

rate_limit_tap = require_rate_limit("rfid_tap", max_requests=120, window_seconds=60)


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

    if user.role not in (UserRole.ADMIN, UserRole.STAFF):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or Staff terminals can process keycard taps.",
        )

    return user, None


# ──────────────────────────────────────────────────────────────────────────────
# 0. Smart Pairing Mode Endpoints
# ──────────────────────────────────────────────────────────────────────────────

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
    return await process_card_tap(
        raw_uid=payload.card_uid,
        scanner_id=payload.scanner_id,
        request=request,
        actor_user=actor_user,
        scanner=scanner,
        db=db,
    )


# State-changing: POST only (a GET here could be triggered cross-site by a plain <img> tag).
@router.post(
    "/access/webhook-tap",
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
    if not resolved_uid:
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
    return await process_card_tap(
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

    override_db = websocket.app.dependency_overrides.get(get_db)
    if override_db is not None:
        gen = override_db()
        db = await anext(gen)
        try:
            try:
                user = await db.get(User, int(payload["sub"]))
            except (ValueError, TypeError):
                user = None
        finally:
            try:
                await gen.aclose()
            except Exception:
                pass
    else:
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
    card_record = await bind_card_to_member(
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
# 5. Hardware Scanner Provisioning
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
