import json
import os
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Encounter, EncounterStatusEnum, RoleEnum

from .schemas import (
    AmbientScribeRequest,
    AmbientScribeResponse,
    DiagnosisCandidate,
    ExtractedEntities,
    MedicationPlanned,
    SOAPNote,
    TranscriptSegment,
)


SYSTEM_PROMPT = """You are the OmniCare AI Ambient Scribe Agent.

You will be given a diarized transcript from a doctor-patient encounter.
Your job is to produce a structured, EHR-ready SOAP note plus extracted clinical entities,
and map diagnoses to ICD-10-CM codes where possible.

Return ONLY JSON that matches the requested schema.

CRITICAL INSTRUCTIONS:
1. SOAP note must fill subjective/objective/assessment/plan with clinically plausible text.
2. extracted_entities.medications_planned should capture meds mentioned in the PLAN (or clearly intended).
3. recent lab orders should go into lab_orders (test names only).
4. ICD-10 codes: include only codes you are confident about; otherwise omit.
"""


class AmbientScribeAgent:
    def __init__(self):
        # Keep consistent with existing chart_prep (preview to avoid quota issues).
        self.model_name = "gemini-3-flash-preview"

    def run(self, db: Session, request: AmbientScribeRequest) -> AmbientScribeResponse:
        encounter: Optional[Encounter] = (
            db.query(Encounter).filter(Encounter.id == request.encounter_id).first()
        )
        if not encounter:
            raise ValueError(f"Encounter with ID {request.encounter_id} not found")

        transcript_segments = self._resolve_transcript(encounter, request.transcript_segments)

        # If transcript is missing, fall back to existing SOAP note if present.
        if not transcript_segments:
            if encounter.soap_note:
                soap_note = SOAPNote(**encounter.soap_note)
            else:
                soap_note = SOAPNote(
                    subjective="No transcript available.",
                    objective="No objective data available.",
                    assessment="Unable to generate assessment without transcript.",
                    plan="Manual documentation required.",
                )

            extracted_entities = self._heuristic_entities_from_encounter(encounter)
            icd10_codes = encounter.icd10_codes or []
            response = AmbientScribeResponse(
                soap_note=soap_note,
                extracted_entities=extracted_entities,
                icd10_codes=icd10_codes,
                confidence_score=0.35,
            )
            self._persist(db, encounter, response)
            return response

        # LLM path
        disable_llm = (os.environ.get("OMNICARE_DISABLE_LLM") == "1") or (not settings.google_api_key)
        if disable_llm:
            soap_note = (
                SOAPNote(**encounter.soap_note)
                if isinstance(encounter.soap_note, dict)
                else SOAPNote(
                    subjective="Transcript received but LLM is disabled.",
                    objective="Objective data not available.",
                    assessment="Manual review required.",
                    plan="Manual documentation required.",
                )
            )
            extracted_entities = self._heuristic_entities_from_encounter(encounter)
            resp = AmbientScribeResponse(
                soap_note=soap_note,
                extracted_entities=extracted_entities,
                icd10_codes=encounter.icd10_codes or [],
                confidence_score=0.2,
            )
            self._persist(db, encounter, resp)
            return resp

        client = genai.Client(api_key=settings.google_api_key)
        transcript_text = self._format_transcript(transcript_segments)

        response_schema: Dict[str, Any] = {
            "type": "OBJECT",
            "properties": {
                "soap_note": {
                    "type": "OBJECT",
                    "properties": {
                        "subjective": {"type": "STRING"},
                        "objective": {"type": "STRING"},
                        "assessment": {"type": "STRING"},
                        "plan": {"type": "STRING"},
                    },
                    "required": ["subjective", "objective", "assessment", "plan"],
                },
                "extracted_entities": {
                    "type": "OBJECT",
                    "properties": {
                        "symptoms": {"type": "ARRAY", "items": {"type": "STRING"}},
                        "diagnoses": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "display": {"type": "STRING"},
                                    "icd10": {"type": "STRING"},
                                },
                                "required": ["display"],
                            },
                        },
                        "medications_planned": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "name": {"type": "STRING"},
                                    "dosage": {"type": "STRING"},
                                    "frequency": {"type": "STRING"},
                                    "route": {"type": "STRING"},
                                    "instructions": {"type": "STRING"},
                                },
                                "required": ["name"],
                            },
                        },
                        "lab_orders": {"type": "ARRAY", "items": {"type": "STRING"}},
                        "procedures": {"type": "ARRAY", "items": {"type": "STRING"}},
                    },
                    "required": ["symptoms", "diagnoses", "medications_planned", "lab_orders", "procedures"],
                },
                "icd10_codes": {"type": "ARRAY", "items": {"type": "STRING"}},
                "confidence_score": {"type": "NUMBER"},
            },
            "required": ["soap_note", "extracted_entities", "icd10_codes", "confidence_score"],
        }

        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=transcript_text,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )
            raw = response.text or ""
            data = json.loads(raw)
            extracted = ExtractedEntities(**data["extracted_entities"])
            diagnoses = [DiagnosisCandidate(**d) for d in extracted.diagnoses]
            medications = [MedicationPlanned(**m) for m in extracted.medications_planned]

            extracted_entities = ExtractedEntities(
                symptoms=extracted.symptoms,
                diagnoses=diagnoses,
                medications_planned=medications,
                lab_orders=extracted.lab_orders,
                procedures=extracted.procedures,
            )

            soap_note = SOAPNote(**data["soap_note"])
            resp = AmbientScribeResponse(
                soap_note=soap_note,
                extracted_entities=extracted_entities,
                icd10_codes=data.get("icd10_codes") or [],
                confidence_score=float(data.get("confidence_score") or 0.5),
                raw_model_output={"raw_text": raw} if raw else None,
            )

            self._persist(db, encounter, resp)
            return resp
        except Exception:
            # Safe fallback to keep the UI flow unblocked.
            soap_note = (
                SOAPNote(**encounter.soap_note)
                if encounter.soap_note
                else SOAPNote(
                    subjective="Transcript parsing failed.",
                    objective="No objective data available.",
                    assessment="Manual review required.",
                    plan="Manual documentation required.",
                )
            )
            extracted_entities = self._heuristic_entities_from_encounter(encounter)
            resp = AmbientScribeResponse(
                soap_note=soap_note,
                extracted_entities=extracted_entities,
                icd10_codes=encounter.icd10_codes or [],
                confidence_score=0.25,
            )
            self._persist(db, encounter, resp)
            return resp

    def _resolve_transcript(
        self,
        encounter: Encounter,
        transcript_segments: Optional[List[TranscriptSegment]],
    ) -> List[TranscriptSegment]:
        if transcript_segments is not None:
            return transcript_segments

        # Encounter.transcript is stored as JSON.
        raw = encounter.transcript
        if not raw:
            return []
        try:
            return [TranscriptSegment(**seg) for seg in raw]
        except Exception:
            # Be forgiving about shape.
            if isinstance(raw, list):
                out: List[TranscriptSegment] = []
                for seg in raw:
                    if not isinstance(seg, dict):
                        continue
                    out.append(
                        TranscriptSegment(
                            speaker=str(seg.get("speaker", "UNKNOWN")),
                            text=str(seg.get("text", "")),
                            start_ms=int(seg.get("start_ms") or 0),
                            end_ms=seg.get("end_ms"),
                            confidence=seg.get("confidence"),
                        )
                    )
                return out
            return []

    def _format_transcript(self, segments: List[TranscriptSegment]) -> str:
        # Compact representation to reduce tokens.
        lines = []
        for s in segments:
            speaker = s.speaker.upper() if s.speaker else "UNKNOWN"
            text = re.sub(r"\s+", " ", s.text).strip()
            lines.append(f"{speaker}: {text}")
        return "\n".join(lines)

    def _heuristic_entities_from_encounter(self, encounter: Encounter) -> ExtractedEntities:
        # Minimal extraction for missing LLM context.
        symptoms: List[str] = []
        diagnoses: List[DiagnosisCandidate] = []
        procedures: List[str] = []
        medications_planned: List[MedicationPlanned] = []
        lab_orders: List[str] = []

        if isinstance(encounter.extracted_entities, dict):
            extracted = encounter.extracted_entities
            symptoms = extracted.get("symptoms") or []
            diagnoses_raw = extracted.get("diagnoses") or []
            for d in diagnoses_raw:
                try:
                    diagnoses.append(DiagnosisCandidate(**d))
                except Exception:
                    diagnoses.append(DiagnosisCandidate(display=str(d)))
            meds_raw = extracted.get("medications_planned") or extracted.get("medications") or []
            for m in meds_raw:
                if isinstance(m, dict):
                    medications_planned.append(MedicationPlanned(**m))
                else:
                    medications_planned.append(MedicationPlanned(name=str(m)))
            lab_orders = extracted.get("lab_orders") or []
            procedures = extracted.get("procedures") or []

        # If we have a soap_note, attempt a couple of regex hints.
        if encounter.soap_note and not medications_planned:
            plan = (encounter.soap_note or {}).get("plan") or ""
            # Very small heuristic: pick up common medication words.
            for name in ["aspirin", "metformin", "pantoprazole", "amoxicillin", "ibuprofen"]:
                if re.search(rf"\b{re.escape(name)}\b", plan, flags=re.IGNORECASE):
                    medications_planned.append(MedicationPlanned(name=name))
        return ExtractedEntities(
            symptoms=symptoms,
            diagnoses=diagnoses,
            medications_planned=medications_planned,
            lab_orders=lab_orders,
            procedures=procedures,
        )

    def _persist(self, db: Session, encounter: Encounter, response: AmbientScribeResponse) -> None:
        encounter.soap_note = response.soap_note.model_dump()
        encounter.extracted_entities = response.extracted_entities.model_dump()
        encounter.icd10_codes = response.icd10_codes
        encounter.status = EncounterStatusEnum.review
        db.add(encounter)
        db.commit()

