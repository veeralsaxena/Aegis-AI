from typing import List, Optional

from pydantic import BaseModel, Field


class MedicationPlannedLite(BaseModel):
    name: str


class CDSAlert(BaseModel):
    id: str
    type: str
    severity: str
    message: str
    source: Optional[str] = None
    requires_acknowledgement: bool = False
    suggested_action: Optional[str] = None


class CDSContextInput(BaseModel):
    allergies: List[str] = Field(default_factory=list)
    current_meds: List[str] = Field(default_factory=list)
    soap_note: Optional[str] = None

class CDSRequest(BaseModel):
    encounter_id: str
    context: Optional[CDSContextInput] = None


class CDSResponse(BaseModel):
    cds_alerts: List[CDSAlert] = Field(default_factory=list)
    confidence_score: float = 0.5

