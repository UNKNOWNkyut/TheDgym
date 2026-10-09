from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.models.user import UserRole


# =========================================================
# PROFILE
# =========================================================

class AccountProfileResponse(BaseModel):
    id: int

    email: EmailStr

    full_name: str

    phone: Optional[str] = None

    role: UserRole

    is_active: bool

    account_status: str

    profile_picture_url: Optional[str] = None

    created_at: datetime

    updated_at: datetime


class AccountProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=255,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        None,
        max_length=50,
    )

    # Required only if the member wants
    # to change their email address.
    current_password: Optional[str] = None


    @field_validator("full_name")
    @classmethod
    def clean_full_name(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return value

        cleaned = value.strip()

        if len(cleaned) < 2:
            raise ValueError(
                "Full name must be at least 2 characters."
            )

        return cleaned


    @field_validator("phone")
    @classmethod
    def clean_phone(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return value

        cleaned = value.strip()

        return cleaned or None


# =========================================================
# CHANGE PASSWORD
# =========================================================

class ChangePasswordRequest(BaseModel):
    current_password: str

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
    )

    confirm_new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
    )


    @model_validator(mode="after")
    def passwords_match(self):

        if (
            self.new_password
            != self.confirm_new_password
        ):
            raise ValueError(
                "New password and confirmation do not match."
            )

        return self


# =========================================================
# OTHER RESPONSES
# =========================================================

class ProfilePictureResponse(BaseModel):
    profile_picture_url: Optional[str] = None


class MessageResponse(BaseModel):
    message: str