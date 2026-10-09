from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class HourlyCheckinStat(BaseModel):
    hour: int
    hour_label: str
    count: int


class ClassPopularityStat(BaseModel):
    name: str
    class_type: str
    total_enrollments: int


class AnalyticsOverviewResponse(BaseModel):
    total_visits_this_month: int
    attendance_growth_pct: float
    active_members_count: int
    average_dwell_minutes: int
    peak_hour: str
    hourly_distribution: List[HourlyCheckinStat]
    popular_classes: List[ClassPopularityStat]


class ChurnOverviewResponse(BaseModel):
    total_members_assessed: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    overall_retention_rate_pct: float


class AtRiskMemberItem(BaseModel):
    member_id: int
    member_code: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    active_plan_name: Optional[str] = None
    days_since_last_checkin: int
    visit_frequency_weekly: float
    churn_probability: float
    risk_tier: str
    top_risk_factors: List[str]
    predicted_at: datetime


class MemberChurnDetailResponse(BaseModel):
    member_id: int
    member_code: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    churn_probability: float
    risk_tier: str
    top_risk_factors: List[str]
    features: Dict[str, Any]
    predicted_at: datetime
