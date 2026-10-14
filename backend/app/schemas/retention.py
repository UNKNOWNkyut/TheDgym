from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


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
    strategy_id: Optional[int] = None
    member_id: int
    title: str
    message: str
    action_text: Optional[str] = "Claim Offer"
    action_url: Optional[str] = "/membership"


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
