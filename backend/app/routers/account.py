from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.core.security import (
    hash_password,
    verify_password,
)

from app.database import get_db

from app.models.user import (
    User,
    UserRole,
)

from app.models.user_profile import UserProfile

from app.schemas.account import (
    AccountProfileResponse,
    AccountProfileUpdate,
    ChangePasswordRequest,
    MessageResponse,
    ProfilePictureResponse,
)


router = APIRouter(
    prefix="/api/account",
    tags=["Member Account Settings"],
)


# =========================================================
# PROFILE PICTURE SETTINGS
# =========================================================

BACKEND_DIR = (
    Path(__file__)
    .resolve()
    .parents[2]
)

PROFILE_PICTURE_DIR = (
    BACKEND_DIR
    / "uploads"
    / "profile_pictures"
)

PROFILE_PICTURE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


MAX_PROFILE_PICTURE_SIZE = (
    5 * 1024 * 1024
)


ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


# =========================================================
# HELPERS
# =========================================================

def _profile_picture_url(
    profile: Optional[UserProfile],
) -> Optional[str]:

    if (
        not profile
        or not profile.profile_picture_path
    ):
        return None

    normalized = (
        profile
        .profile_picture_path
        .replace("\\", "/")
        .lstrip("/")
    )

    if normalized.startswith(
        "uploads/"
    ):
        normalized = normalized[
            len("uploads/"):
        ]

    return (
        f"/api/uploads/"
        f"{normalized}"
    )


def _profile_response(
    user: User,
    profile: Optional[UserProfile],
) -> AccountProfileResponse:

    return AccountProfileResponse(
        id=user.id,

        email=user.email,

        full_name=user.full_name,

        phone=user.phone,

        role=user.role,

        is_active=user.is_active,

        account_status=(
            "active"
            if user.is_active
            else "inactive"
        ),

        profile_picture_url=(
            _profile_picture_url(
                profile
            )
        ),

        created_at=user.created_at,

        updated_at=user.updated_at,
    )


async def _get_profile(
    db: AsyncSession,
    user_id: int,
) -> Optional[UserProfile]:

    result = await db.execute(
        select(
            UserProfile
        ).where(
            UserProfile.user_id
            == user_id
        )
    )

    return (
        result.scalar_one_or_none()
    )


async def _get_or_create_profile(
    db: AsyncSession,
    user_id: int,
) -> UserProfile:

    profile = await _get_profile(
        db,
        user_id,
    )

    if profile:
        return profile

    profile = UserProfile(
        user_id=user_id,
    )

    db.add(profile)

    await db.flush()

    return profile


def _delete_picture_file(
    relative_path: Optional[str],
) -> None:

    if not relative_path:
        return

    try:

        candidate = (
            BACKEND_DIR
            / relative_path
        ).resolve()

        upload_root = (
            PROFILE_PICTURE_DIR
            .resolve()
        )

        # Security check:
        # only remove files inside the
        # profile picture directory.
        if (
            candidate.parent
            != upload_root
        ):
            return

        if (
            candidate.exists()
            and candidate.is_file()
        ):
            candidate.unlink()

    except OSError:

        # Old missing files should not
        # break the request.
        pass


# =========================================================
# GET MEMBER PROFILE
# =========================================================

@router.get(
    "/profile",
    response_model=AccountProfileResponse,
)
async def get_account_profile(
    db: AsyncSession = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_roles([
            UserRole.MEMBER
        ])
    ),
):

    profile = await _get_profile(
        db,
        current_user.id,
    )

    return _profile_response(
        current_user,
        profile,
    )


# =========================================================
# EDIT MEMBER PROFILE
# =========================================================

@router.patch(
    "/profile",
    response_model=AccountProfileResponse,
)
async def update_account_profile(
    data: AccountProfileUpdate,
    db: AsyncSession = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_roles([
            UserRole.MEMBER
        ])
    ),
):

    update_data = data.model_dump(
        exclude_unset=True
    )


    # -----------------------------------------------------
    # EMAIL
    # -----------------------------------------------------

    if (
        "email" in update_data
        and update_data["email"]
        is not None
    ):

        new_email = (
            str(
                update_data["email"]
            )
            .lower()
            .strip()
        )


        if (
            new_email
            != current_user.email
        ):

            # Changing email is sensitive,
            # so require the current password.
            if (
                not data.current_password
                or not verify_password(
                    data.current_password,
                    current_user.hashed_password,
                )
            ):

                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail=(
                        "Current password is required "
                        "to change your email address."
                    ),
                )


            duplicate = await db.execute(
                select(
                    User
                ).where(
                    User.email
                    == new_email,

                    User.id
                    != current_user.id,
                )
            )


            if (
                duplicate
                .scalar_one_or_none()
            ):

                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail=(
                        "An account with this "
                        "email address already exists."
                    ),
                )


            current_user.email = (
                new_email
            )


    # -----------------------------------------------------
    # FULL NAME
    # -----------------------------------------------------

    if (
        "full_name" in update_data
        and update_data["full_name"]
        is not None
    ):

        current_user.full_name = (
            update_data[
                "full_name"
            ].strip()
        )


    # -----------------------------------------------------
    # PHONE
    # -----------------------------------------------------

    if "phone" in update_data:

        current_user.phone = (
            update_data["phone"]
        )


    await db.commit()

    await db.refresh(
        current_user
    )


    profile = await _get_profile(
        db,
        current_user.id,
    )


    return _profile_response(
        current_user,
        profile,
    )


# =========================================================
# UPLOAD PROFILE PICTURE
# =========================================================

@router.post(
    "/profile-picture",
    response_model=ProfilePictureResponse,
)
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_roles([
            UserRole.MEMBER
        ])
    ),
):

    extension = (
        ALLOWED_IMAGE_TYPES.get(
            file.content_type or ""
        )
    )


    if not extension:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Profile picture must be "
                "a JPG, PNG, or WEBP image."
            ),
        )


    filename = (
        f"user_"
        f"{current_user.id}_"
        f"{uuid4().hex}"
        f"{extension}"
    )


    destination = (
        PROFILE_PICTURE_DIR
        / filename
    )


    total_size = 0


    try:

        with destination.open(
            "wb"
        ) as output:

            while chunk := await file.read(
                1024 * 1024
            ):

                total_size += len(
                    chunk
                )


                if (
                    total_size
                    > MAX_PROFILE_PICTURE_SIZE
                ):

                    output.close()

                    destination.unlink(
                        missing_ok=True
                    )

                    raise HTTPException(
                        status_code=(
                            status
                            .HTTP_413_REQUEST_ENTITY_TOO_LARGE
                        ),
                        detail=(
                            "Profile picture must "
                            "be 5 MB or smaller."
                        ),
                    )


                output.write(
                    chunk
                )

    finally:

        await file.close()


    profile = (
        await _get_or_create_profile(
            db,
            current_user.id,
        )
    )


    old_picture_path = (
        profile.profile_picture_path
    )


    profile.profile_picture_path = (
        f"uploads/"
        f"profile_pictures/"
        f"{filename}"
    )


    await db.commit()

    await db.refresh(
        profile
    )


    if (
        old_picture_path
        and old_picture_path
        != profile.profile_picture_path
    ):

        _delete_picture_file(
            old_picture_path
        )


    return ProfilePictureResponse(
        profile_picture_url=(
            _profile_picture_url(
                profile
            )
        )
    )


# =========================================================
# DELETE PROFILE PICTURE
# =========================================================

@router.delete(
    "/profile-picture",
    response_model=ProfilePictureResponse,
)
async def delete_profile_picture(
    db: AsyncSession = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_roles([
            UserRole.MEMBER
        ])
    ),
):

    profile = await _get_profile(
        db,
        current_user.id,
    )


    if (
        not profile
        or not profile.profile_picture_path
    ):

        return ProfilePictureResponse(
            profile_picture_url=None
        )


    old_picture_path = (
        profile.profile_picture_path
    )


    profile.profile_picture_path = None


    await db.commit()


    _delete_picture_file(
        old_picture_path
    )


    return ProfilePictureResponse(
        profile_picture_url=None
    )


# =========================================================
# CHANGE PASSWORD
# =========================================================

@router.post(
    "/change-password",
    response_model=MessageResponse,
)
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_roles([
            UserRole.MEMBER
        ])
    ),
):

    if not verify_password(
        data.current_password,
        current_user.hashed_password,
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Current password is incorrect."
            ),
        )


    if verify_password(
        data.new_password,
        current_user.hashed_password,
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "New password must be different "
                "from your current password."
            ),
        )


    current_user.hashed_password = (
        hash_password(
            data.new_password
        )
    )


    await db.commit()


    return MessageResponse(
        message=(
            "Password changed successfully."
        )
    )
