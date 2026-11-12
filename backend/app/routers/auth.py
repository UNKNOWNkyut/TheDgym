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
from app.core.security import (
    create_access_token,
    create_face_challenge_token,
    decode_face_challenge_token,
    hash_password,
    revoke_token,
    verify_password,
)
from app.database import get_db
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.membership_plan import MembershipPlan
from app.models.user import User, UserRole
from app.models.user_biometric import UserBiometric
from app.models.user_profile import UserProfile
from app.schemas.auth import (
    BiometricProvidersResponse,
    FaceEnrollRequest,
    FaceVerifyRequest,
    GoogleLoginRequest,
    LoginChallengeResponse,
    LoginUserPreview,
    OcrScanRequest,
    OcrScanResponse,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from app.init_members import generate_member_code
from app.services.audit import record_audit_log
from app.services.biometrics import (
    FACE_LOGIN_MATCH_THRESHOLD,
    ID_SELFIE_MATCH_THRESHOLD,
    build_biometric_record,
    euclidean_distance,
    parse_stored_descriptor,
    validate_descriptor,
)
from app.services.external_vision import (
    compare_faces_facepp,
    extract_id_text_ocr_space,
    sanitize_base64_image,
)

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

    bio_id = (
        await db.execute(
            select(UserBiometric.id).where(
                UserBiometric.user_id == user.id,
                UserBiometric.is_enrolled.is_(True),
            )
        )
    ).scalar_one_or_none()

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
        face_enrolled=bio_id is not None,
    )


async def _issue_face_challenge(
    user: User, db: AsyncSession
) -> LoginChallengeResponse:
    """Issue a short-lived Step 2 challenge token requiring face verification or first-login enrollment."""
    biometric = (
        await db.execute(
            select(UserBiometric).where(
                UserBiometric.user_id == user.id,
                UserBiometric.is_enrolled.is_(True),
            )
        )
    ).scalar_one_or_none()
    enrollment_required = biometric is None
    purpose = "face_enroll" if enrollment_required else "face_verify"

    return LoginChallengeResponse(
        requires_face_verification=True,
        enrollment_required=enrollment_required,
        challenge_token=create_face_challenge_token(user.id, purpose),
        user=LoginUserPreview(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
        ),
    )


async def _load_challenge_user(
    token: str,
    expected_purpose: str,
    db: AsyncSession,
) -> User:
    """Validate a Step 2 face challenge token and return the active user."""
    payload = decode_face_challenge_token(token, expected_purpose)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Face verification session expired or invalid. Please sign in again.",
        )

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification challenge subject.",
        )

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact gym administration.",
        )
    return user


def _validate_enrollment_biometrics(
    *,
    liveness_passed: bool,
    face_descriptor: list[float],
    id_face_match_score: float,
) -> list[float]:
    """Validate liveness, descriptor shape, and ID-to-selfie match score before persisting."""
    if not liveness_passed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liveness check must be completed before verification.",
        )
    if id_face_match_score > ID_SELFIE_MATCH_THRESHOLD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live selfie does not sufficiently match the photo on your valid ID.",
        )
    try:
        return validate_descriptor(face_descriptor)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


async def _verify_enrollment_images_facepp(
    *,
    id_image_base64: str | None,
    live_image_base64: str | None,
) -> tuple[str | None, str]:
    """Sanitize reference selfie image and verify ID-vs-selfie via Face++ when configured."""
    safe_live_data_url: str | None = None
    if live_image_base64:
        try:
            safe_live_data_url, _ = sanitize_base64_image(live_image_base64)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if not (settings.FACEPP_API_KEY and settings.FACEPP_API_SECRET):
        return safe_live_data_url, "faceapi_local"

    if not (id_image_base64 and live_image_base64):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both ID image and live selfie capture are required when cloud Face++ verification is enabled.",
        )

    face_res = await compare_faces_facepp(
        id_image_base64,
        live_image_base64,
        api_key=settings.FACEPP_API_KEY,
        api_secret=settings.FACEPP_API_SECRET,
        base_url=settings.FACEPP_API_BASE_URL,
        threshold_key="1e-3",
    )
    if face_res.ok:
        if not face_res.matched:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Face++ ID-to-selfie verification did not match. Ensure both faces are clear.",
            )
        return safe_live_data_url, "facepp"

    if not face_res.is_service_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Face++ could not verify faces: {face_res.error}",
        )

    return safe_live_data_url, "faceapi_local"


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
    """Register a new user account with mandatory ID verification + face biometric enrollment."""
    normalized_email = user_in.email.lower().strip()

    validated_descriptor = _validate_enrollment_biometrics(
        liveness_passed=user_in.liveness_passed,
        face_descriptor=user_in.face_descriptor,
        id_face_match_score=user_in.id_face_match_score,
    )
    safe_live_b64, verification_provider = await _verify_enrollment_images_facepp(
        id_image_base64=user_in.id_image_base64,
        live_image_base64=user_in.live_image_base64,
    )

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

    try:
        biometric_row = build_biometric_record(
            user_id=new_user.id,
            descriptor=validated_descriptor,
            id_type=user_in.id_type,
            id_number=user_in.id_number,
            id_ocr_name=user_in.id_ocr_name,
            id_face_match_score=user_in.id_face_match_score,
            reference_selfie_b64=safe_live_b64,
            verification_provider=verification_provider,
        )
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    db.add(biometric_row)

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


@router.post("/login", response_model=LoginChallengeResponse, dependencies=[Depends(rate_limit_auth)])
async def login(
    credentials: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Step 1 authentication: verify email/password and return a single-use face 2FA challenge."""
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
        action="AUTH_LOGIN_STEP1_CHALLENGE",
        outcome="SUCCESS",
        actor=user,
        target_type="user",
        target_id=user.id,
        request=request,
    )
    await db.commit()

    return await _issue_face_challenge(user, db)


@router.post("/google", response_model=LoginChallengeResponse, dependencies=[Depends(rate_limit_auth)])
async def google_auth(
    payload: GoogleLoginRequest,
    request: Request,
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

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured on this server.",
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

    # 2. Check issuer and audience fail-closed (Check 30)
    token_iss = google_data.get("iss")
    if token_iss not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token issuer."
        )

    if google_data.get("aud") != settings.GOOGLE_CLIENT_ID:
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

    # 3. Check if user already exists (keep User + INACTIVE Member creation atomic)
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name[:255],
            role=UserRole.MEMBER,
            is_active=True,
        )
        db.add(user)
        await db.flush()

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

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact gym administration.",
        )

    await record_audit_log(
        db,
        action="AUTH_GOOGLE_STEP1_CHALLENGE",
        outcome="SUCCESS",
        actor=user,
        target_type="user",
        target_id=user.id,
        request=request,
    )
    await db.commit()
    await db.refresh(user)

    # 4. Require Step 2 face verification / first-login enrollment before issuing session JWT
    return await _issue_face_challenge(user, db)


@router.get("/biometrics/providers", response_model=BiometricProvidersResponse)
async def get_biometric_providers():
    """Expose which OCR and face recognition providers are active (booleans only, no secrets)."""
    ocr_ready = bool(settings.OCR_SPACE_API_KEY)
    face_ready = bool(settings.FACEPP_API_KEY and settings.FACEPP_API_SECRET)
    return BiometricProvidersResponse(
        ocr_provider="ocr_space" if ocr_ready else "tesseract_local",
        face_provider="facepp" if face_ready else "faceapi_local",
        ocr_api_configured=ocr_ready,
        face_api_configured=face_ready,
    )


@router.post(
    "/biometrics/ocr",
    response_model=OcrScanResponse,
    dependencies=[Depends(rate_limit_auth)],
)
async def scan_id_ocr_cloud(payload: OcrScanRequest):
    """Run ID text extraction via OCR.space REST API when configured."""
    if not settings.OCR_SPACE_API_KEY:
        return OcrScanResponse(
            provider="tesseract_local",
            raw_text="",
            used_external_api=False,
        )

    result = await extract_id_text_ocr_space(
        payload.image_base64,
        settings.OCR_SPACE_API_KEY,
    )
    if not result.ok:
        return OcrScanResponse(
            provider="tesseract_local",
            raw_text="",
            used_external_api=False,
        )

    return OcrScanResponse(
        provider=result.provider,
        raw_text=result.raw_text,
        used_external_api=True,
    )


@router.post("/face/verify", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def verify_face_login(
    payload: FaceVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Step 2 authentication: verify live face descriptor + liveness against stored embedding."""
    if not payload.liveness_passed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liveness check must be completed before face verification.",
        )

    try:
        probe_vec = validate_descriptor(payload.face_descriptor)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    user = await _load_challenge_user(payload.challenge_token, "face_verify", db)
    biometric = (
        await db.execute(
            select(UserBiometric).where(
                UserBiometric.user_id == user.id,
                UserBiometric.is_enrolled.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not biometric:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No face biometric enrolled for this account. Please sign in again to enroll.",
        )

    stored_vec = parse_stored_descriptor(biometric.face_descriptor_json)
    distance = euclidean_distance(probe_vec, stored_vec)
    if distance > FACE_LOGIN_MATCH_THRESHOLD:
        await record_audit_log(
            db,
            action="AUTH_FACE_VERIFY_FAILED",
            outcome="FAILURE",
            actor=user,
            target_type="user",
            target_id=user.id,
            request=request,
            details=f"Face mismatch (distance={distance:.4f}, threshold={FACE_LOGIN_MATCH_THRESHOLD}).",
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Face did not match your enrolled profile. Adjust lighting and try again.",
        )

    verify_provider = "faceapi_local"
    verify_detail = f"Verified face login (distance={distance:.4f})."
    if settings.FACEPP_API_KEY and settings.FACEPP_API_SECRET and biometric.reference_selfie_b64:
        if not payload.live_image_base64:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Live face snapshot is required when cloud Face++ verification is enabled.",
            )
        face_res = await compare_faces_facepp(
            biometric.reference_selfie_b64,
            payload.live_image_base64,
            api_key=settings.FACEPP_API_KEY,
            api_secret=settings.FACEPP_API_SECRET,
            base_url=settings.FACEPP_API_BASE_URL,
            threshold_key="1e-4",
        )
        if face_res.ok:
            if not face_res.matched:
                await record_audit_log(
                    db,
                    action="AUTH_FACE_VERIFY_FAILED",
                    outcome="FAILURE",
                    actor=user,
                    target_type="user",
                    target_id=user.id,
                    request=request,
                    details=f"Face++ mismatch (confidence={face_res.confidence:.2f}, threshold={face_res.threshold:.2f}).",
                )
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Face++ verification failed: live face did not match your enrolled profile.",
                )
            verify_provider = "facepp"
            verify_detail = f"Verified face login via Face++ (confidence={face_res.confidence:.2f}, distance={distance:.4f})."
        elif not face_res.is_service_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Face++ could not verify face image: {face_res.error}",
            )

    biometric.verification_provider = verify_provider
    biometric.last_verified_at = datetime.now(timezone.utc)
    revoke_token(payload.challenge_token)
    await record_audit_log(
        db,
        action="AUTH_FACE_VERIFY_SUCCESS",
        outcome="SUCCESS",
        actor=user,
        target_type="user",
        target_id=user.id,
        request=request,
        details=verify_detail,
    )
    await db.commit()

    return await _issue_auth_response(user, response, db)


@router.post("/face/enroll", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def enroll_face_first_login(
    payload: FaceEnrollRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """First-login onboarding: enroll valid ID + live face descriptor for legacy/admin-created accounts."""
    validated_descriptor = _validate_enrollment_biometrics(
        liveness_passed=payload.liveness_passed,
        face_descriptor=payload.face_descriptor,
        id_face_match_score=payload.id_face_match_score,
    )
    safe_live_b64, verification_provider = await _verify_enrollment_images_facepp(
        id_image_base64=payload.id_image_base64,
        live_image_base64=payload.live_image_base64,
    )
    user = await _load_challenge_user(payload.challenge_token, "face_enroll", db)

    existing_bio = (
        await db.execute(select(UserBiometric).where(UserBiometric.user_id == user.id))
    ).scalar_one_or_none()
    if existing_bio and existing_bio.is_enrolled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Face biometric is already enrolled for this account. Please sign in again.",
        )

    try:
        new_bio = build_biometric_record(
            user_id=user.id,
            descriptor=validated_descriptor,
            id_type=payload.id_type,
            id_number=payload.id_number,
            id_ocr_name=payload.id_ocr_name,
            id_face_match_score=payload.id_face_match_score,
            reference_selfie_b64=safe_live_b64,
            verification_provider=verification_provider,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if existing_bio:
        existing_bio.face_descriptor_json = new_bio.face_descriptor_json
        existing_bio.descriptor_version = new_bio.descriptor_version
        existing_bio.id_type = new_bio.id_type
        existing_bio.id_number_masked = new_bio.id_number_masked
        existing_bio.id_number_hash = new_bio.id_number_hash
        existing_bio.id_ocr_name = new_bio.id_ocr_name
        existing_bio.id_face_match_score = new_bio.id_face_match_score
        existing_bio.reference_selfie_b64 = new_bio.reference_selfie_b64
        existing_bio.verification_provider = new_bio.verification_provider
        existing_bio.is_enrolled = True
        existing_bio.enrolled_at = datetime.now(timezone.utc)
        existing_bio.last_verified_at = datetime.now(timezone.utc)
    else:
        new_bio.last_verified_at = datetime.now(timezone.utc)
        db.add(new_bio)

    revoke_token(payload.challenge_token)
    await record_audit_log(
        db,
        action="AUTH_FACE_ENROLLED",
        outcome="SUCCESS",
        actor=user,
        target_type="user",
        target_id=user.id,
        request=request,
        details=f"Enrolled ID ({new_bio.id_type}) and live face biometric on first login.",
    )
    await db.commit()

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
            status=MemberStatus.INACTIVE,
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
