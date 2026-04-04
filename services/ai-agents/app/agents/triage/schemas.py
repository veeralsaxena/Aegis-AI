from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BloodPressure(BaseModel):
    systolic: Optional[float] = None
    diastolic: Optional[float] = None


class MedicationAdherenceItem(BaseModel):
    medication_name: str
    taken: bool
    taken_at: Optional[str] = None


class TriageSubmission(BaseModel):
    submission_date: date
    day_number: int = Field(ge=1, le=7)
    pain_level: Optional[float] = Field(default=None, ge=0, le=10)
    temperature_f: Optional[float] = Field(default=None)
    blood_pressure: Optional[BloodPressure] = None
    mood: Optional[str] = None
    medication_adherence: List[MedicationAdherenceItem] = Field(default_factory=list)
    wound_photo_url: Optional[str] = None
    free_text_notes: Optional[str] = None


class TriageDetails(BaseModel):
    risk_factors: List[str] = Field(default_factory=list)
    recommended_action: str
    escalated: bool


class TriageResponse(BaseModel):
    triage_result: str
    triage_details: TriageDetails
    patient_message: str


class TriageRequest(BaseModel):
    care_plan_id: str
    submission: TriageSubmission

