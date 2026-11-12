from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128, description="Password must be 6 to 128 characters")
    full_name: str = Field(..., min_length=2, max_length=150, description="Full name of the user")
    phone: Optional[str] = Field(None, max_length=32)
    plan_slug: Optional[str] = Field(None, max_length=100)
    face_descriptor: List[float] = Field(..., min_length=128, max_length=128)
    liveness_passed: bool = Field(...)
    id_type: str = Field(..., min_length=2, max_length=50)
    id_number: Optional[str] = Field(None, max_length=64)
    id_ocr_name: Optional[str] = Field(None, max_length=150)
    id_face_match_score: float = Field(..., ge=0.0, le=2.0)
    id_image_base64: Optional[str] = Field(None, max_length=2_200_000)
    live_image_base64: Optional[str] = Field(None, max_length=2_200_000)


class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class GoogleLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credential: str = Field(..., min_length=10, max_length=4096, description="Google ID Token JWT")


class UserCreateAdmin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=32)
    role: UserRole = UserRole.MEMBER


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=32)
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime
    has_active_membership: bool = False
    membership_status: Optional[str] = None
    plan_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    face_enrolled: bool = False

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginUserPreview(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole


class LoginChallengeResponse(BaseModel):
    requires_face_verification: bool = True
    enrollment_required: bool
    challenge_token: str
    user: LoginUserPreview


class FaceVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_token: str = Field(..., min_length=16, max_length=4096)
    face_descriptor: List[float] = Field(..., min_length=128, max_length=128)
    liveness_passed: bool = Field(...)
    live_image_base64: Optional[str] = Field(None, max_length=2_200_000)


class FaceEnrollRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_token: str = Field(..., min_length=16, max_length=4096)
    face_descriptor: List[float] = Field(..., min_length=128, max_length=128)
    liveness_passed: bool = Field(...)
    id_type: str = Field(..., min_length=2, max_length=50)
    id_number: Optional[str] = Field(None, max_length=64)
    id_ocr_name: Optional[str] = Field(None, max_length=150)
    id_face_match_score: float = Field(..., ge=0.0, le=2.0)
    id_image_base64: Optional[str] = Field(None, max_length=2_200_000)
    live_image_base64: Optional[str] = Field(None, max_length=2_200_000)


class OcrScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(..., min_length=64, max_length=2_200_000)


class OcrScanResponse(BaseModel):
    provider: str
    raw_text: str = ""
    used_external_api: bool = False


class BiometricProvidersResponse(BaseModel):
    ocr_provider: str
    face_provider: str
    ocr_api_configured: bool
    face_api_configured: bool
    id_image_base64: Optional[str] = Field(None, max_length=2_200_000)
    live_image_base64: Optional[str] = Field(None, max_length=2_200_000)


class AuditLogResponse(BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    ip_address: Optional[str] = None
    outcome: str
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
