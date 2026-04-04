from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    speaker: str
    text: str
    start_ms: int
    end_ms: Optional[int] = None
    confidence: Optional[float] = None


class SOAPNote(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str


class MedicationPlanned(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    instructions: Optional[str] = None


class DiagnosisCandidate(BaseModel):
    display: str
    icd10: Optional[str] = None


class ExtractedEntities(BaseModel):
    symptoms: List[str] = Field(default_factory=list)
    diagnoses: List[DiagnosisCandidate] = Field(default_factory=list)
    medications_planned: List[MedicationPlanned] = Field(default_factory=list)
    lab_orders: List[str] = Field(default_factory=list)
    procedures: List[str] = Field(default_factory=list)


class AmbientScribeRequest(BaseModel):
    encounter_id: str
    # Optional: allow passing transcript segments directly for simulations.
    transcript_segments: Optional[List[TranscriptSegment]] = None


class AmbientScribeResponse(BaseModel):
    soap_note: SOAPNote
    extracted_entities: ExtractedEntities
    icd10_codes: List[str] = Field(default_factory=list)
    confidence_score: float

    # Helpful for debugging the structured generation.
    raw_model_output: Optional[Dict[str, Any]] = None

