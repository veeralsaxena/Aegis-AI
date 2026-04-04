from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class MedicationOnDischarge(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None


class CarePlanTask(BaseModel):
    type: str
    time: str
    description: str


class CarePlanDay(BaseModel):
    day: int = Field(ge=1, le=7)
    tasks: List[CarePlanTask] = Field(default_factory=list)


class TriageThresholds(BaseModel):
    pain_max: float = 7
    temp_max_f: float = 101.5
    bp_systolic_max: float = 180
    custom: List[Any] = Field(default_factory=list)


class FollowUpCarePlanRequest(BaseModel):
    patient_id: str
    encounter_id: str
    provider_id: str
    discharge_date: date
    discharge_summary: str
    medications_on_discharge: List[MedicationOnDischarge] = Field(default_factory=list)


class FollowUpCarePlanResponse(BaseModel):
    care_plan_id: str
    start_date: str
    end_date: str
    medications: List[Dict[str, Any]] = Field(default_factory=list)
    daily_schedule: List[Dict[str, Any]] = Field(default_factory=list)
    tracking_modules: List[Dict[str, Any]] = Field(default_factory=list)
    triage_thresholds: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = 0.5

