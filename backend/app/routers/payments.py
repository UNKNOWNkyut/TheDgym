"""
Online Payment Gateway Router powered by Xendit (https://xendit.co).
Supports automated online membership payments via GCash, Maya, QR Ph, & Cards,
with real-time webhook callback processing and instant portal membership activation.
"""
import hmac
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user, require_roles
from app.core.rate_limit import require_rate_limit
from app.database import get_db
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.user import User, UserRole
from app.seed_members import generate_member_code
from app.services.audit import record_audit_log
from app.services.membership_activation import (
    activate_member_and_notify_on_payment,
    broadcast_admin_member_notification,
    count_prior_paid_memberships,
)
from app.services.xendit_service import (
    create_xendit_invoice,
    get_xendit_invoice,
    get_xendit_invoice_by_external_id,
    get_xendit_secret_key,
    get_xendit_webhook_token,
    map_xendit_payment_method,
)

logger = logging.getLogger("dgym.payments")

router = APIRouter(prefix="/api/payments", tags=["Online Payments & Checkout"])
rate_limit_checkout = require_rate_limit("payment_checkout", max_requests=10, window_seconds=60)
rate_limit_webhook = require_rate_limit("payment_webhook", max_requests=60, window_seconds=60)


class CreateCheckoutRequest(BaseModel):
    plan_id: Optional[int] = Field(None, description="Target Membership Plan ID")
    plan_slug: Optional[str] = Field(None, description="Target Membership Plan Slug (e.g. 'monthly')")
    success_url: Optional[str] = Field(None, description="Custom success redirect URL")
    failure_url: Optional[str] = Field(None, description="Custom failure redirect URL")


_EXTERNAL_ID_RE = re.compile(r"^DGM-(\d+)-(\d+)-(\d+)$")
_INVOICE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,128}$")


def _allowed_origin_pairs() -> set[tuple[str, str]]:
    pairs: set[tuple[str, str]] = set()
    for raw in settings.CORS_ORIGINS:
        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            pairs.add((parsed.scheme.lower(), parsed.netloc.lower()))
    return pairs


def _resolve_redirect_url(
    custom_url: Optional[str],
    origin_header: Optional[str],
    default_path: str,
) -> str:
    allowed = _allowed_origin_pairs()
    fallback_origin = settings.CORS_ORIGINS[0].rstrip("/") if settings.CORS_ORIGINS else "http://localhost:5173"

    base_origin = fallback_origin
    if origin_header:
        parsed_origin = urlparse(origin_header)
        if (parsed_origin.scheme.lower(), parsed_origin.netloc.lower()) in allowed:
            base_origin = f"{parsed_origin.scheme.lower()}://{parsed_origin.netloc}"

    if not custom_url:
        return f"{base_origin}{default_path}"

    cleaned = custom_url.strip()
    if cleaned.startswith("/") and not cleaned.startswith("//"):
        return f"{base_origin}{cleaned}"

    parsed_custom = urlparse(cleaned)
    if (
        parsed_custom.scheme.lower() in ("http", "https")
        and (parsed_custom.scheme.lower(), parsed_custom.netloc.lower()) in allowed
    ):
        return cleaned

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Untrusted redirect URL origin.",
    )


def _parse_paid_amount(raw_amount: Any) -> Decimal:
    if raw_amount is None or isinstance(raw_amount, bool) or not str(raw_amount).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount is missing from invoice payload.",
        )
    try:
        return Decimal(str(raw_amount))
    except InvalidOperation as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment amount format.",
        ) from exc


async def _activate_membership_from_xendit(
    db: AsyncSession,
    *,
    member: Member,
    plan: MembershipPlan,
    paid_amount: Decimal,
    mapped_pm: PaymentMethod,
    payment_ref: str,
    notes: str,
) -> tuple[MemberMembership, bool]:
    """
    Idempotently record and activate a paid Xendit membership within one atomic transaction.
    Returns `(membership, already_processed)`.
    """
    stmt_dup = select(MemberMembership).where(MemberMembership.payment_reference == payment_ref)
    existing_ms = (await db.execute(stmt_dup)).scalar_one_or_none()
    if existing_ms:
        return existing_ms, True

    expected_price = Decimal(str(plan.price_php))
    if paid_amount < expected_price:
        logger.warning(
            "Rejected underpaid Xendit invoice ref=%s: paid=%s expected=%s",
            payment_ref,
            paid_amount,
            expected_price,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Paid amount ({paid_amount}) is below plan price ({expected_price}).",
        )

    now = datetime.now(timezone.utc)
    new_ms = MemberMembership(
        member_id=member.id,
        plan_id=plan.id,
        start_date=now,
        end_date=now + timedelta(days=plan.duration_days),
        status=MembershipStatus.ACTIVE,
        paid_amount=paid_amount,
        payment_method=mapped_pm,
        payment_reference=payment_ref,
        notes=notes,
    )
    db.add(new_ms)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existing_ms = (await db.execute(stmt_dup)).scalar_one_or_none()
        if existing_ms:
            return existing_ms, True
        raise

    prior_paid = await count_prior_paid_memberships(
        db,
        member_id=member.id,
        exclude_membership_id=new_ms.id,
    )
    notify_admin = await activate_member_and_notify_on_payment(
        db,
        membership=new_ms,
        member=member,
        plan=plan,
        paid_amount=paid_amount,
        payment_method=mapped_pm,
        is_new_member_activation=(prior_paid == 0),
    )
    await db.commit()
    await db.refresh(new_ms)

    if notify_admin:
        try:
            await broadcast_admin_member_notification(member)
        except Exception as exc:
            logger.warning("Non-fatal WS admin broadcast error after payment: %s", exc)

    return new_ms, False


# ─────────────────────────────────────────────────────────────────────────────
# 1. CREATE CHECKOUT SESSION
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/create-checkout",
    summary="Create a secure Xendit hosted checkout invoice for a membership plan",
    dependencies=[Depends(rate_limit_checkout)],
)
async def create_checkout_session(
    payload: CreateCheckoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Initializes a Xendit checkout invoice for GCash, Maya, QR Ph, or Card payment.
    Returns the hosted invoice_url where the customer can pay.
    """
    if not get_xendit_secret_key():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Xendit payment gateway is not configured on this server.",
        )

    # 1. Find the target plan
    if payload.plan_id:
        stmt_plan = select(MembershipPlan).where(MembershipPlan.id == payload.plan_id)
    elif payload.plan_slug:
        stmt_plan = select(MembershipPlan).where(MembershipPlan.slug == payload.plan_slug.lower().strip())
    else:
        raise HTTPException(status_code=400, detail="Either plan_id or plan_slug must be provided.")

    plan = (await db.execute(stmt_plan)).scalar_one_or_none()
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Selected membership plan is inactive or does not exist.")

    # 2. Find or associate the member record
    stmt_mem = select(Member).where(Member.email == current_user.email.lower().strip())
    member = (await db.execute(stmt_mem)).scalar_one_or_none()
    if not member:
        # Create minimal member profile if one doesn't exist yet for this registered user
        names = current_user.full_name.split(" ", 1)
        first_name = names[0] if names else "Member"
        last_name = names[1] if len(names) > 1 else "DGym"
        member_code = await generate_member_code(db)
        member = Member(
            member_code=member_code,
            first_name=first_name,
            last_name=last_name,
            email=current_user.email.lower().strip(),
            phone=current_user.phone or "",
            status=MemberStatus.INACTIVE,
            is_active=True,
            address="Rosario, Batangas",
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)

    # 3. Generate structured external_id: DGM-{member_id}-{plan_id}-{timestamp}
    ts = int(time.time())
    external_id = f"DGM-{member.id}-{plan.id}-{ts}"

    # Determine allowlisted redirect URLs
    origin_header = request.headers.get("origin")
    success_redirect = _resolve_redirect_url(
        payload.success_url,
        origin_header,
        f"/payment?status=success&external_id={external_id}",
    )
    failure_redirect = _resolve_redirect_url(
        payload.failure_url,
        origin_header,
        "/payment?status=failed",
    )

    # 4. Call Xendit API
    inv_res = await create_xendit_invoice(
        external_id=external_id,
        amount=float(plan.price_php),
        description=f"The DGym Rosario — {plan.name} ({plan.duration_days} Days)",
        payer_email=current_user.email,
        customer_name=current_user.full_name,
        customer_phone=member.phone or current_user.phone,
        success_redirect_url=success_redirect,
        failure_redirect_url=failure_redirect,
        metadata={
            "member_id": member.id,
            "plan_id": plan.id,
            "user_id": current_user.id,
            "plan_slug": plan.slug,
        },
    )

    if inv_res.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create checkout invoice: {inv_res.get('message')}",
        )

    await record_audit_log(
        db,
        action="ONLINE_CHECKOUT_CREATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="plan",
        target_id=plan.id,
        request=request,
        details=f"Created Xendit checkout for {plan.name} (₱{plan.price_php}). Invoice #{inv_res.get('invoice_id')}.",
    )
    await db.commit()

    return {
        "status": "success",
        "invoice_id": inv_res.get("invoice_id"),
        "invoice_url": inv_res.get("invoice_url"),
        "external_id": external_id,
        "amount": inv_res.get("amount"),
        "plan_name": plan.name,
        "plan_price": float(plan.price_php),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. XENDIT WEBHOOK HANDLER
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/webhook/xendit",
    summary="Asynchronous webhook receiver for Xendit payment events",
    dependencies=[Depends(rate_limit_webhook)],
)
async def xendit_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_callback_token: Optional[str] = Header(None),
):
    """
    Receives automated invoice notifications from Xendit.
    When an invoice status is 'PAID', activates the membership and sends an in-app admin notification.
    """
    # 1. Fail-closed callback token verification
    configured_token = get_xendit_webhook_token()
    if configured_token:
        if not x_callback_token or not hmac.compare_digest(x_callback_token, configured_token):
            logger.warning("Xendit webhook rejected: invalid callback token.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid callback token.")
    elif settings.ENVIRONMENT != "development":
        logger.error("Xendit webhook rejected: XENDIT_WEBHOOK_VERIFICATION_TOKEN is not configured.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook verification token is not configured.",
        )

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    logger.info("Xendit webhook received: status=%s external_id=%s", data.get("status"), data.get("external_id"))

    # Only process PAID invoices (require configured webhook token before activating PAID even in dev)
    inv_status = str(data.get("status", "")).upper()
    if inv_status != "PAID":
        return {"status": "ignored", "reason": f"Invoice status is {inv_status}"}

    if not configured_token:
        logger.error("Rejected PAID Xendit webhook: XENDIT_WEBHOOK_VERIFICATION_TOKEN is unset.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook verification token must be configured to process PAID invoices.",
        )

    external_id = data.get("external_id", "")
    match = _EXTERNAL_ID_RE.match(external_id)
    if not match:
        logger.warning("Unrecognized external_id format in Xendit webhook: %s", external_id)
        return {"status": "ignored", "reason": "unrecognized_external_id"}

    member_id = int(match.group(1))
    plan_id = int(match.group(2))

    # Check member & plan
    member = await db.get(Member, member_id)
    plan = await db.get(MembershipPlan, plan_id)
    if not member or not plan:
        logger.error("Member #%s or Plan #%s not found in Xendit webhook.", member_id, plan_id)
        return {"status": "error", "reason": "entity_not_found"}

    raw_channel = data.get("payment_channel") or data.get("payment_method") or "ONLINE"
    mapped_pm = map_xendit_payment_method(raw_channel)
    raw_amount = data.get("paid_amount") if data.get("paid_amount") is not None else data.get("amount")
    paid_amount = _parse_paid_amount(raw_amount)
    payment_ref = f"XND-{data.get('id') or external_id}"

    membership, already_processed = await _activate_membership_from_xendit(
        db,
        member=member,
        plan=plan,
        paid_amount=paid_amount,
        mapped_pm=mapped_pm,
        payment_ref=payment_ref,
        notes=f"Paid online via Xendit ({raw_channel}). Invoice ID: {data.get('id')}",
    )
    if already_processed:
        return {"status": "already_processed", "membership_id": membership.id}

    logger.info("Successfully activated membership #%s for Member #%s via Xendit.", membership.id, member.id)
    return {
        "status": "success",
        "membership_id": membership.id,
        "member_name": member.full_name,
        "plan_name": plan.name,
        "payment_method": mapped_pm.value,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. VERIFY CHECKOUT INVOICE (Frontend Redirect Return)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/verify/{invoice_id}",
    summary="Verify Xendit invoice status and confirm membership activation",
)
async def verify_checkout_status(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Called by the frontend checkout return page to verify payment completion
    and ensure the member's account has been activated.
    """
    if not _INVOICE_ID_RE.fullmatch(invoice_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice identifier.",
        )

    if invoice_id.startswith("DGM-"):
        inv_data = await get_xendit_invoice_by_external_id(invoice_id)
    else:
        inv_data = await get_xendit_invoice(invoice_id)

    if inv_data.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to retrieve invoice status from Xendit.",
        )

    resolved_invoice_id = inv_data.get("invoice_id") or invoice_id
    inv_status = str(inv_data.get("invoice_status", "")).upper()
    external_id = str(inv_data.get("external_id") or "")
    payment_ref = f"XND-{resolved_invoice_id}"
    match = _EXTERNAL_ID_RE.match(external_id)

    # Enforce invoice ownership so members cannot query or probe other members' invoices
    if current_user.role not in (UserRole.ADMIN, UserRole.STAFF):
        if not match:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to verify this payment invoice.",
            )
        target_member_id = int(match.group(1))
        stmt_caller_mem = select(Member).where(Member.email == current_user.email.lower().strip())
        caller_mem = (await db.execute(stmt_caller_mem)).scalar_one_or_none()
        if not caller_mem or caller_mem.id != target_member_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to verify this payment invoice.",
            )

    # Check if already recorded in our database
    stmt_ms = select(MemberMembership).where(MemberMembership.payment_reference == payment_ref)
    existing_ms = (await db.execute(stmt_ms)).scalar_one_or_none()

    # If paid in Xendit but not yet processed by webhook, process immediately!
    if inv_status == "PAID" and not existing_ms and match:
        member_id = int(match.group(1))
        plan_id = int(match.group(2))
        member = await db.get(Member, member_id)
        plan = await db.get(MembershipPlan, plan_id)

        if member and plan:
            raw_channel = inv_data.get("payment_channel") or inv_data.get("payment_method") or "ONLINE"
            mapped_pm = map_xendit_payment_method(raw_channel)
            raw_inv = inv_data.get("raw") if isinstance(inv_data.get("raw"), dict) else {}
            raw_amount = inv_data.get("paid_amount")
            if raw_amount is None:
                raw_amount = raw_inv.get("paid_amount")
            if raw_amount is None:
                raw_amount = inv_data.get("amount")
            paid_amount = _parse_paid_amount(raw_amount)
            existing_ms, _ = await _activate_membership_from_xendit(
                db,
                member=member,
                plan=plan,
                paid_amount=paid_amount,
                mapped_pm=mapped_pm,
                payment_ref=payment_ref,
                notes=f"Paid online via Xendit verify check ({raw_channel}).",
            )

    return {
        "status": "success",
        "invoice_id": invoice_id,
        "invoice_status": inv_status,
        "is_paid": (inv_status == "PAID"),
        "amount": inv_data.get("amount"),
        "payment_method": inv_data.get("payment_method"),
        "membership_activated": existing_ms is not None,
        "membership_id": existing_ms.id if existing_ms else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. HEALTH / CONFIG STATUS
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/status",
    summary="Get online payment gateway configuration status",
)
async def get_payment_gateway_status(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Administrative status of online payment integrations."""
    key = get_xendit_secret_key()
    return {
        "provider": "xendit",
        "configured": bool(key),
        "is_test_mode": key.startswith("xnd_development_"),
        "supported_channels": [
            "GCash",
            "Maya",
            "QR Ph (BDO, BPI, UnionBank, GCash)",
            "Credit / Debit Card (Visa, Mastercard, JCB)",
            "Direct Debit (BPI, UBP, Chinabank, RCBC)",
            "7-Eleven & Cebuana OTC",
        ],
    }
