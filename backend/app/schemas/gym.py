from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.member import MemberStatus, Gender
from app.models.member_membership import MembershipStatus, PaymentMethod


# ──────────────────────────────────────────────────────────────────────────────
# Member Schemas (Checks 16 & 51)
# ──────────────────────────────────────────────────────────────────────────────

class MemberCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=32)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    address: Optional[str] = Field(None, max_length=500)
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_phone: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = Field(None, max_length=2000)


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=32)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    address: Optional[str] = Field(None, max_length=500)
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_phone: Optional[str] = Field(None, max_length=32)
    status: Optional[MemberStatus] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=2000)


class MembershipSummary(BaseModel):
    """Minimal membership info embedded in MemberResponse."""
    id: int
    plan_name: str
    start_date: datetime
    end_date: datetime
    status: MembershipStatus

    model_config = ConfigDict(from_attributes=True)


class MemberResponse(BaseModel):
    id: int
    member_code: str
    first_name: str
    last_name: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    status: MemberStatus
    is_active: bool
    notes: Optional[str] = None
    joined_at: datetime
    created_at: datetime
    updated_at: datetime
    memberships: List["MembershipResponse"] = []

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────────────────────
# Membership Plan Schemas
# ──────────────────────────────────────────────────────────────────────────────

class MembershipPlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    duration_days: int = Field(..., ge=1, le=3650)
    price_php: Decimal = Field(..., ge=0, le=Decimal("1000000.00"))
    is_active: bool = True
    sort_order: int = 0


class MembershipPlanUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    duration_days: Optional[int] = Field(None, ge=1, le=3650)
    price_php: Optional[Decimal] = Field(None, ge=0, le=Decimal("1000000.00"))
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class MembershipPlanResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    duration_days: int
    price_php: Decimal
    is_active: bool
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────────────────────
# Member Membership (Assign Plan) Schemas
# ──────────────────────────────────────────────────────────────────────────────

class AssignMembershipCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    member_id: int = Field(..., ge=1)
    plan_id: int = Field(..., ge=1)
    start_date: datetime
    paid_amount: Optional[Decimal] = Field(None, ge=0, le=Decimal("1000000.00"))
    payment_method: Optional[PaymentMethod] = PaymentMethod.CASH
    payment_reference: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)


class MembershipUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[MembershipStatus] = None
    paid_amount: Optional[Decimal] = Field(None, ge=0, le=Decimal("1000000.00"))
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)


class MembershipResponse(BaseModel):
    id: int
    member_id: int
    plan_id: int
    plan_name: Optional[str] = None
    start_date: datetime
    end_date: datetime
    status: MembershipStatus
    paid_amount: Optional[Decimal] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Forward reference resolution
MemberResponse.model_rebuild()
