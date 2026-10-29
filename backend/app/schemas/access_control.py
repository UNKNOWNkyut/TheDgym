from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.access_scanner import ScannerTapMode
from app.models.keycard_tap_log import TapDecision
from app.models.member_keycard import KeycardStatus, normalize_card_uid


class TapVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    card_uid: str = Field(..., min_length=4, max_length=64, description="Raw RFID/NFC card UID")
    scanner_id: Optional[int] = Field(None, ge=1)

    @field_validator("card_uid")
    @classmethod
    def validate_uid(cls, v: str) -> str:
        norm = normalize_card_uid(v)
        if len(norm) < 4 or len(norm) > 64:
            raise ValueError("Card UID must contain between 4 and 64 alphanumeric characters.")
        return norm


class KeycardPairRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    card_uid: str = Field(..., min_length=4, max_length=64, description="Raw RFID/NFC card UID")
    card_label: str = Field(default="NFC Smart Keycard", min_length=1, max_length=100)

    @field_validator("card_uid")
    @classmethod
    def validate_uid(cls, v: str) -> str:
        norm = normalize_card_uid(v)
        if len(norm) < 4 or len(norm) > 64:
            raise ValueError("Card UID must contain between 4 and 64 alphanumeric characters.")
        return norm


class KeycardStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: KeycardStatus
    reason: Optional[str] = Field(None, max_length=500)


class MemberKeycardResponse(BaseModel):
    id: int
    member_id: int
    card_uid_masked: str
    card_label: str
    status: KeycardStatus
    issued_at: datetime
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None
    last_tapped_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TapVerificationResponse(BaseModel):
    granted: bool
    decision: TapDecision
    reason_message: str
    privacy_safe_message: str
    card_uid_masked: str
    member_id: Optional[int] = None
    member_code: Optional[str] = None
    member_name: Optional[str] = None
    member_status: Optional[str] = None
    plan_name: Optional[str] = None
    membership_end_date: Optional[datetime] = None
    days_remaining: Optional[int] = None
    warning_banner: Optional[str] = None
    visit_id: Optional[int] = None
    visit_type: Optional[str] = None
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    latency_ms: int
    tapped_at: datetime


class KeycardTapLogResponse(BaseModel):
    id: int
    keycard_id: Optional[int] = None
    member_id: Optional[int] = None
    member_code: Optional[str] = None
    member_name: Optional[str] = None
    scanner_name: Optional[str] = None
    visit_id: Optional[int] = None
    card_uid_masked: str
    decision: TapDecision
    granted: bool
    reason_message: str
    plan_name: Optional[str] = None
    days_remaining: Optional[int] = None
    warning_banner: Optional[str] = None
    latency_ms: int
    tapped_at: datetime


class AccessScannerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=120)
    location: str = Field(default="Front Desk Reception", min_length=2, max_length=150)
    tap_mode: ScannerTapMode = ScannerTapMode.TOGGLE_IN_OUT


class AccessScannerProvisionResponse(BaseModel):
    id: int
    name: str
    location: str
    tap_mode: ScannerTapMode
    api_key_prefix: str
    raw_api_key: str
    created_at: datetime


class AccessScannerResponse(BaseModel):
    id: int
    name: str
    location: str
    tap_mode: ScannerTapMode
    api_key_prefix: str
    is_active: bool
    last_heartbeat_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SimulatorPresetItem(BaseModel):
    id: str
    label: str
    description: str
    badge_tone: str
    card_uid: str
    expected_outcome: str


class PairingSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    member_id: int = Field(..., ge=1)
    card_label: str = Field(default="NFC Smart Keycard", min_length=1, max_length=100)


class PairingSessionStatus(BaseModel):
    active: bool
    member_id: Optional[int] = None
    member_code: Optional[str] = None
    member_name: Optional[str] = None
    card_label: Optional[str] = None
    expires_at: Optional[datetime] = None


class AccessControlSettings(BaseModel):
    demo_fast_cooldown: bool
    checkin_cooldown_seconds: int
    post_checkout_cooldown_seconds: int
    weekday_sat_hours: str
    sunday_hours: str


class AccessControlSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    demo_fast_cooldown: bool
