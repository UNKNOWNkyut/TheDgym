import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import null, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import extract_token_from_request, get_current_user
from app.core.rate_limit import rate_limit_auth, rate_limit_sensitive
from app.core.security import create_access_token, hash_password, revoke_token, verify_password
from app.database import get_db
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.membership_plan import MembershipPlan
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile
from app.schemas.auth import GoogleLoginRequest, TokenResponse, UserLogin, UserRegister, UserResponse
from app.seed_members import generate_member_code
from app.services.audit import record_audit_log

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class AvailPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_slug: str = Field(..., min_length=1, max_length=100)


def _split_full_name(
    full_name: str, default_first: str = "Member", default_last: str = "Client"
) -> tuple[str, str]:
    parts = full_name.strip().split()
    first = (parts[0] if parts else default_first)[:100]
    last = (" ".join(parts[1:]) if len(parts) > 1 else default_last)[:100]
    return first, last


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


async def _build_user_response(user: User, db: AsyncSession) -> UserResponse:
    """Build UserResponse with membership status, active plan, and profile picture."""
    stmt_mem = (
        select(Member)
        .where(Member.email == user.email.lower().strip())
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
        .execution_options(populate_existing=True)  # never serve a stale memberships collection
    )
    member = (await db.execute(stmt_mem)).scalar_one_or_none()

    has_active_membership = False
    membership_status = "none"
    plan_name = None

    if member:
        now = datetime.now(timezone.utc)
        active_m = None
        pending_m = None
        for m in member.memberships or []:
            end_d = _as_utc(m.end_date)
            if end_d and m.status == MembershipStatus.ACTIVE and end_d >= now:
                active_m = m
                break
            if m.status == MembershipStatus.PENDING and pending_m is None:
                pending_m = m

        if active_m:
            has_active_membership = True
            membership_status = "active"
            plan_name = active_m.plan.name if active_m.plan else "Member Pass"
        elif pending_m:
            membership_status = "pending"
            plan_name = pending_m.plan.name if pending_m.plan else "Pending Plan"

    if user.role in (UserRole.ADMIN, UserRole.STAFF):
        has_active_membership = True
        membership_status = "active"

    # Profile picture
    prof = (
        await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    ).scalar_one_or_none()
    profile_picture_url = None
    if prof and prof.profile_picture_path:
        norm = prof.profile_picture_path.replace("\\", "/").lstrip("/")
        if norm.startswith("uploads/"):
            norm = norm[len("uploads/") :]
        profile_picture_url = f"/api/uploads/{norm}"

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        has_active_membership=has_active_membership,
        membership_status=membership_status,
        plan_name=plan_name,
        profile_picture_url=profile_picture_url,
    )


async def _issue_auth_response(user: User, response: Response, db: AsyncSession) -> TokenResponse:
    # Generate JWT
    access_token = create_access_token(
        {"sub": str(user.id), "email": user.email, "role": user.role.value}
    )

    # Set httpOnly cookie for secure persistence
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )

    user_resp = await _build_user_response(user, db)
    return TokenResponse(access_token=access_token, token_type="bearer", user=user_resp)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_auth)],
)
async def register(
    user_in: UserRegister,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account with optional initial plan (pending front-desk verification)."""
    normalized_email = user_in.email.lower().strip()

    # Check if user already exists
    existing_user = (
        await db.execute(select(User).where(User.email == normalized_email))
    ).scalar_one_or_none()

    if existing_user:
        await record_audit_log(
            db,
            action="AUTH_REGISTER_DUPLICATE",
            outcome="FAILURE",
            actor_email=normalized_email,
            request=request,
            details="Registration attempted with an already registered email.",
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Create new user
    clean_phone = user_in.phone.strip() if user_in.phone else None
    new_user = User(
        email=normalized_email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        phone=clean_phone,
        role=UserRole.MEMBER,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    first_name, last_name = _split_full_name(user_in.full_name, "User", "Account")
    member_code = await generate_member_code(db)

    # If user selected a training plan in registration Step 2
    plan = None
    if user_in.plan_slug and user_in.plan_slug.strip():
        stmt_plan = select(MembershipPlan).where(
            MembershipPlan.slug == user_in.plan_slug.strip().lower(),
            MembershipPlan.is_active.is_(True),
        )
        plan = (await db.execute(stmt_plan)).scalar_one_or_none()

    # SKIP & REGISTER: Registered user remains INACTIVE until payment is confirmed
    new_mem = Member(
        member_code=member_code,
        first_name=first_name,
        last_name=last_name,
        email=normalized_email,
        phone=clean_phone,
        status=MemberStatus.INACTIVE,
        is_active=True,
    )
    db.add(new_mem)
    await db.flush()

    if plan:
        now = datetime.now(timezone.utc)
        duration = plan.duration_days or 30
        db.add(
            MemberMembership(
                member_id=new_mem.id,
                plan_id=plan.id,
                start_date=now,
                end_date=now + timedelta(days=duration),
                status=MembershipStatus.PENDING,
                paid_amount=Decimal("0.00"),
                payment_method=null(),  # explicit NULL: column default (CASH) must not fire for unpaid rows
                notes=f"Pending front-desk payment verification (registered online: {plan.name})",
            )
        )

    await record_audit_log(
        db,
        action="AUTH_REGISTER_SUCCESS",
        outcome="SUCCESS",
        actor=new_user,
        target_type="user",
        target_id=new_user.id,
        request=request,
        details=f"Registered account (plan_slug={user_in.plan_slug or 'none'}, pending_verification={bool(plan)}).",
    )
    await db.commit()
    await db.refresh(new_user)

    return await _issue_auth_response(new_user, response, db)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def login(
    credentials: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email and password using constant-time verification."""
    normalized_email = credentials.email.lower().strip()
    user = (
        await db.execute(select(User).where(User.email == normalized_email))
    ).scalar_one_or_none()

    # Check 26: Always run Argon2 verification even when user is None to prevent timing enumeration
    password_valid = verify_password(credentials.password, user.hashed_password if user else None)

    if not user or not password_valid:
        await record_audit_log(
            db,
            action="AUTH_LOGIN_FAILED",
            outcome="FAILURE",
            actor_email=normalized_email,
            request=request,
            details="Invalid email or password.",
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        await record_audit_log(
            db,
            action="AUTH_LOGIN_DEACTIVATED",
            outcome="FAILURE",
            actor=user,
            request=request,
            details="Login blocked because account is deactivated.",
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact gym administration.",
        )

    await record_audit_log(
        db,
        action="AUTH_LOGIN_SUCCESS",
        outcome="SUCCESS",
        actor=user,
        target_type="user",
        target_id=user.id,
        request=request,
    )
    await db.commit()

    return await _issue_auth_response(user, response, db)


@router.post("/google", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def google_auth(
    payload: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate or register a user using Google OAuth ID Token (JWT).
    Verifies token with Google's public tokeninfo service, extracts profile,
    and returns a DGym JWT access token.
    """
    token = payload.credential.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential token is required.",
        )

    # 1. Verify token with Google's public tokeninfo endpoint
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo", params={"id_token": token}
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google token.",
                )
            google_data = resp.json()
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to connect to Google authentication service.",
        )

    # 2. Check issuer and audience (Check 30)
    token_iss = google_data.get("iss")
    if token_iss and token_iss not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token issuer."
        )

    if settings.GOOGLE_CLIENT_ID and google_data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token was not issued for this application client.",
        )

    # Ensure Google email is verified before trusting it for account linking
    if str(google_data.get("email_verified")).lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email address is not verified.",
        )

    email = (google_data.get("email") or "").lower().strip()
    full_name = (google_data.get("name") or "").strip() or email.split("@")[0].title()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not provide an email address.",
        )

    # 3. Check if user already exists
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()

    if not user:
        # Create user account
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name[:255],
            role=UserRole.MEMBER,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Ensure Member record exists as INACTIVE (registered account until plan is availed)
        existing_mem = (
            await db.execute(select(Member).where(Member.email == email))
        ).scalar_one_or_none()
        if not existing_mem:
            first_name, last_name = _split_full_name(full_name)
            member_code = await generate_member_code(db)
            db.add(
                Member(
                    member_code=member_code,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    status=MemberStatus.INACTIVE,
                    is_active=True,
                )
            )
            await db.commit()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact gym administration.",
        )

    await record_audit_log(
        db,
        action="AUTH_GOOGLE_LOGIN_SUCCESS",
        outcome="SUCCESS",
        actor=user,
        target_type="user",
        target_id=user.id,
        request=request,
    )
    await db.commit()

    # 4. Generate DGym JWT access token
    return await _issue_auth_response(user, response, db)


@router.post("/avail-plan", response_model=UserResponse, dependencies=[Depends(rate_limit_sensitive)])
async def avail_plan(
    payload: AvailPlanRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a membership plan online; remains PENDING (PHP 0 paid) until front-desk verification."""
    stmt_plan = select(MembershipPlan).where(
        MembershipPlan.slug == payload.plan_slug.strip().lower(),
        MembershipPlan.is_active.is_(True),
    )
    plan = (await db.execute(stmt_plan)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Active membership plan not found.")

    normalized_email = current_user.email.lower().strip()
    stmt_mem = (
        select(Member)
        .where(Member.email == normalized_email)
        .options(selectinload(Member.memberships))
    )
    member = (await db.execute(stmt_mem)).scalar_one_or_none()

    if not member:
        first_name, last_name = _split_full_name(current_user.full_name)
        member = Member(
            member_code=await generate_member_code(db),
            first_name=first_name,
            last_name=last_name,
            email=normalized_email,
            phone=current_user.phone,
            status=MemberStatus.ACTIVE,
            is_active=True,
        )
        db.add(member)
        await db.flush()
        existing_memberships = []
    else:
        if not member.is_active or member.status == MemberStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your member profile is restricted. Please contact the front desk.",
            )
        if member.status == MemberStatus.INACTIVE:
            member.status = MemberStatus.ACTIVE
        existing_memberships = list(member.memberships or [])

    now = datetime.now(timezone.utc)
    if any(
        ms.status == MembershipStatus.ACTIVE and (_as_utc(ms.end_date) or now) >= now
        for ms in existing_memberships
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active membership plan.",
        )

    duration = plan.duration_days or 30
    note_text = f"Pending front-desk payment verification ({plan.name})"
    pending_ms = next(
        (ms for ms in existing_memberships if ms.status == MembershipStatus.PENDING), None
    )
    if pending_ms:
        pending_ms.plan_id = plan.id
        pending_ms.start_date = now
        pending_ms.end_date = now + timedelta(days=duration)
        pending_ms.paid_amount = Decimal("0.00")
        pending_ms.payment_method = None
        pending_ms.notes = note_text
    else:
        db.add(
            MemberMembership(
                member_id=member.id,
                plan_id=plan.id,
                start_date=now,
                end_date=now + timedelta(days=duration),
                status=MembershipStatus.PENDING,
                paid_amount=Decimal("0.00"),
                payment_method=null(),  # explicit NULL: column default (CASH) must not fire for unpaid rows
                notes=note_text,
            )
        )

    await record_audit_log(
        db,
        action="MEMBERSHIP_AVAIL_PLAN",
        outcome="SUCCESS",
        actor=current_user,
        target_type="membership_plan",
        target_id=plan.id,
        request=request,
        details=f"User requested plan '{plan.name}' (PHP {plan.price_php}) — pending front-desk payment verification.",
    )
    await db.commit()

    return await _build_user_response(current_user, db)


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Revoke active JWT token and clear session cookie (Check 25)."""
    token = extract_token_from_request(request)
    if token:
        revoke_token(token)
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    return {"message": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the profile of the currently authenticated user with membership details."""
    return await _build_user_response(current_user, db)
