from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.visit import VisitType
from app.models.class_session import ClassType, ClassStatus
from app.models.pt_session import PTSessionStatus


# ──────────────────────────────────────────────────────────────────────────────
# Visit Schemas
# ──────────────────────────────────────────────────────────────────────────────

class VisitCreate(BaseModel):
    member_id: int
    visit_type: VisitType = VisitType.WALK_IN
    notes: Optional[str] = None


class VisitCheckOut(BaseModel):
    checked_out_at: Optional[datetime] = None  # defaults to now if omitted


class VisitResponse(BaseModel):
    id: int
    member_id: int
    member_code: Optional[str] = None
    member_name: Optional[str] = None
    visit_type: VisitType
    checked_in_at: datetime
    checked_out_at: Optional[datetime] = None
    notes: Optional[str] = None
    recorded_by_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────────────────
# Class Session Schemas
# ──────────────────────────────────────────────────────────────────────────────

class ClassSessionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    coach_id: Optional[int] = None
    class_type: ClassType = ClassType.OPEN_GYM
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    max_capacity: int = Field(default=20, ge=1, le=200)
    location: Optional[str] = None
    notes: Optional[str] = None


class ClassSessionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    coach_id: Optional[int] = None
    class_type: Optional[ClassType] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=480)
    max_capacity: Optional[int] = Field(None, ge=1, le=200)
    status: Optional[ClassStatus] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class EnrollmentResponse(BaseModel):
    id: int
    member_id: int
    member_code: Optional[str] = None
    member_name: Optional[str] = None
    enrolled_at: datetime

    class Config:
        from_attributes = True


class ClassSessionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    coach_id: Optional[int] = None
    coach_name: Optional[str] = None
    class_type: ClassType
    scheduled_at: datetime
    duration_minutes: int
    max_capacity: int
    enrolled_count: int
    status: ClassStatus
    location: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    enrollments: List[EnrollmentResponse] = []

    class Config:
        from_attributes = True


class EnrollMemberCreate(BaseModel):
    member_id: int
    notes: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# PT Session Schemas
# ──────────────────────────────────────────────────────────────────────────────

class PTSessionCreate(BaseModel):
    trainer_id: Optional[int] = None
    member_id: int
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=240)
    notes: Optional[str] = None
    coach_notes: Optional[str] = None


class PTSessionBookCreate(BaseModel):
    """Schema for a Member submitting a PT booking request."""
    trainer_id: int
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=240)
    notes: Optional[str] = None


class PTSessionApprove(BaseModel):
    coach_notes: Optional[str] = None


class PTSessionReject(BaseModel):
    reason: Optional[str] = None


class PTSessionUpdate(BaseModel):
    trainer_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=240)
    status: Optional[PTSessionStatus] = None
    notes: Optional[str] = None
    coach_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class PTSessionResponse(BaseModel):
    id: int
    trainer_id: Optional[int] = None
    trainer_name: Optional[str] = None
    member_id: int
    member_code: Optional[str] = None
    member_name: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int
    status: PTSessionStatus
    notes: Optional[str] = None
    coach_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TrainerPublicResponse(BaseModel):
    id: int
    full_name: str
    email: str
    specialties: List[str] = []
    bio: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True

