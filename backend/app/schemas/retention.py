from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class RetentionStrategyResponse(BaseModel):
    id: int
    member_id: int
    risk_tier: str
    churn_probability: float
    urgency: str
    strategy_title: str
    diagnosis_summary: str
    tactical_action_steps: List[str]
    offer_title: str
    offer_message: str
    offer_action_text: str
    offer_action_url: str
    status: str
    dispatched_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DispatchOfferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    strategy_id: Optional[int] = Field(None, ge=1)
    member_id: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    action_text: Optional[str] = Field(default="Claim Offer", max_length=60)
    action_url: Optional[str] = Field(default="/membership", max_length=255)

    @field_validator("action_url")
    @classmethod
    def validate_safe_internal_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return "/membership"
        cleaned = value.strip()
        if not cleaned.startswith("/") or cleaned.startswith("//") or "javascript:" in cleaned.lower():
            raise ValueError("action_url must be a safe internal relative route starting with '/'")
        return cleaned


class NotificationResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    member_id: Optional[int] = None
    title: str
    message: str
    type: str
    action_text: Optional[str] = None
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
