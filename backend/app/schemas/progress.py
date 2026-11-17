from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TrainingPlanUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal_focus: Optional[str] = Field(None, max_length=120)
    workout_plan_summary: Optional[str] = Field(None, max_length=2000)
    workout_split_json: Optional[str] = Field(None, max_length=12000)
    meal_plan_summary: Optional[str] = Field(None, max_length=2000)
    meal_plan_json: Optional[str] = Field(None, max_length=8000)


class TrainingPlanResponse(BaseModel):
    id: int
    member_id: int
    goal_focus: Optional[str] = None
    workout_plan_summary: Optional[str] = None
    workout_split_json: Optional[str] = None
    meal_plan_summary: Optional[str] = None
    meal_plan_json: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProgressEntryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Strength & Overload
    exercise_name: Optional[str] = Field(None, max_length=120)
    weight_kg: Optional[float] = Field(None, ge=0, le=1000)
    sets: Optional[int] = Field(None, ge=1, le=50)
    reps: Optional[int] = Field(None, ge=1, le=200)
    rpe: Optional[float] = Field(None, ge=1, le=10)
    rir: Optional[int] = Field(None, ge=0, le=10)
    rest_seconds: Optional[int] = Field(None, ge=5, le=900)

    # Body Composition (cm / kg)
    body_weight_kg: Optional[float] = Field(None, ge=20, le=400)
    waist_cm: Optional[float] = Field(None, ge=30, le=250)
    hips_cm: Optional[float] = Field(None, ge=30, le=250)
    chest_cm: Optional[float] = Field(None, ge=40, le=250)
    arms_cm: Optional[float] = Field(None, ge=15, le=100)
    thighs_cm: Optional[float] = Field(None, ge=25, le=150)

    # Cardio & Recovery
    resting_heart_rate: Optional[int] = Field(None, ge=30, le=220)
    notes: Optional[str] = Field(None, max_length=1000)
    recorded_at: Optional[datetime] = None


class ProgressEntryResponse(BaseModel):
    id: int
    member_id: int
    recorded_by_user_id: Optional[int] = None
    recorded_by_name: Optional[str] = None

    exercise_name: Optional[str] = None
    weight_kg: Optional[float] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    training_volume: Optional[float] = None
    rpe: Optional[float] = None
    rir: Optional[int] = None
    rest_seconds: Optional[int] = None

    body_weight_kg: Optional[float] = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    arms_cm: Optional[float] = None
    thighs_cm: Optional[float] = None

    resting_heart_rate: Optional[int] = None
    notes: Optional[str] = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProgressAttendanceSummary(BaseModel):
    visits_last_30_days: int
    total_visits: int
    completed_pt_sessions: int
    active_week_streak: int
    last_visit_at: Optional[datetime] = None
    latest_resting_heart_rate: Optional[int] = None


class ClientProgressReportResponse(BaseModel):
    member_id: int
    member_code: str
    member_name: str
    member_status: str
    active_plan_name: Optional[str] = None
    assigned_plan: Optional[TrainingPlanResponse] = None
    attendance: ProgressAttendanceSummary
    entries: List[ProgressEntryResponse]
    recent_coach_notes: List[str] = []
