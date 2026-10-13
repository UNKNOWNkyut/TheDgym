import secrets
from datetime import timedelta
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.member import Member, MemberStatus
from app.models.user import User, UserRole
from app.schemas.auth import (
    GoogleLoginRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from app.seed_members import generate_member_code

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new gym member account."""
    # Check if user already exists
    stmt = select(User).where(User.email == user_in.email.lower().strip())
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Create new member
    new_user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        phone=user_in.phone.strip() if user_in.phone else None,
        role=UserRole.MEMBER,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Generate JWT
    token_data = {"sub": str(new_user.id), "email": new_user.email, "role": new_user.role.value}
    access_token = create_access_token(token_data)

    # Set httpOnly cookie for secure persistence
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email and password."""
    stmt = select(User).where(User.email == credentials.email.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact gym administration.",
        )

    # Generate token
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    access_token = create_access_token(token_data)

    # Set httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleLoginRequest,
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
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google token.",
                )
            google_data = resp.json()
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to connect to Google authentication service: {str(e)}",
        )

    # 2. Check audience if GOOGLE_CLIENT_ID is configured in environment
    if settings.GOOGLE_CLIENT_ID:
        token_aud = google_data.get("aud")
        if token_aud != settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google token was not issued for this application client.",
            )

    email = (google_data.get("email") or "").lower().strip()
    full_name = (google_data.get("name") or "").strip() or email.split("@")[0].title()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not provide an email address.",
        )

    # 3. Check if user already exists
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Create user account
        random_pwd = secrets.token_urlsafe(32)
        user = User(
            email=email,
            hashed_password=hash_password(random_pwd),
            full_name=full_name,
            role=UserRole.MEMBER,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Ensure Member record exists
        stmt_mem = select(Member).where(Member.email == email)
        mem_res = await db.execute(stmt_mem)
        if not mem_res.scalar_one_or_none():
            name_parts = full_name.split()
            first_name = name_parts[0] if name_parts else "Member"
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Client"
            member_code = await generate_member_code(db)
            new_mem = Member(
                member_code=member_code,
                first_name=first_name,
                last_name=last_name,
                email=email,
                status=MemberStatus.ACTIVE,
                is_active=True,
            )
            db.add(new_mem)
            await db.commit()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact gym administration.",
        )

    # 4. Generate DGym JWT access token
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    access_token = create_access_token(token_data)

    # Set httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
async def logout(response: Response):
    """Clear session cookie and log out."""
    response.delete_cookie(key="access_token", httponly=True, samesite="lax")
    return {"message": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)
