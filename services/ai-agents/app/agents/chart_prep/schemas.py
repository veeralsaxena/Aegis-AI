from pydantic import BaseModel, Field
from typing import List, Optional

class PatientContextInput(BaseModel):
    full_name: str
    gender: Optional[str] = None
    dob: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    medications: List[dict] = Field(default_factory=list)
    labs: List[dict] = Field(default_factory=list)
    encounters: List[dict] = Field(default_factory=list)

class ChartPrepRequest(BaseModel):
    patient_id: str
    encounter_id: str
    context: Optional[PatientContextInput] = None

class MedicationSchema(BaseModel):
    name: str
    frequency: str
    last_prescribed: str

class AbnormalLabSchema(BaseModel):
    test: str
    value: str
    date: str
    flag: str

class PreVisitSummary(BaseModel):
    active_problems: List[str]
    current_medications: List[MedicationSchema]
    recent_abnormal_labs: List[AbnormalLabSchema]
    open_referrals: List[str]
    allergies: List[str]
    last_visit_reason: str
    flags: List[str]

class ChartPrepResponse(BaseModel):
    pre_visit_summary: PreVisitSummary
    confidence_score: float
    sources_fetched: List[str]
