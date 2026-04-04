import json
import os
import re
import uuid
from typing import Dict, List, Optional

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Allergy, Encounter, EncounterStatusEnum, LabResult, Medication, RoleEnum

from .schemas import CDSAlert, CDSRequest, CDSResponse


SYSTEM_PROMPT = """You are the OmniCare AI Clinical Decision Support (CDS) Agent.

You will be given:
1) a SOAP note (subjective/objective/assessment/plan),
2) patient clinical context (allergies, current meds, recent labs),
3) the extracted entities from the note (medications planned, diagnoses).

Your job is to produce a list of CDS alerts:
- drug-drug interaction alerts (if obvious based on medication names),
- drug-allergy alerts,
- safety warnings and common guideline reminders.

Return ONLY valid JSON:
{ "cds_alerts": [ ... ], "confidence_score": <number> }

Important:
- If you are unsure, produce fewer alerts instead of hallucinating.
- Severity must be one of: INFO, WARNING, CRITICAL.
- requires_acknowledgement should be true for WARNING/CRITICAL alerts that require a human check.
"""


class CDSAgent:
    def __init__(self):
        self.model_name = "gemini-3-flash-preview"

    def run(self, db: Session, request: CDSRequest) -> CDSResponse:
        if request.context:
            prompt_context = {
                "soap_note": request.context.soap_note or "",
                "patient_history": {
                    "known_allergies": [{"substance": a} for a in request.context.allergies],
                    "active_medications": [{"name": m, "dosage": "", "frequency": "", "route": ""} for m in request.context.current_meds],
                    "recent_labs": [],
                    "diagnoses_from_note": [],
                },
                "new_medications_planned": [],
            }
            disable_llm = (os.environ.get("OMNICARE_DISABLE_LLM") == "1") or (not settings.google_api_key)
            class DummyAllergy:
                def __init__(self, substance):
                    self.substance = substance
                    self.reaction = None
                    self.severity = None
            class DummyMedication:
                def __init__(self, name):
                    self.name = name
            
            dummy_active_meds = [DummyMedication(m) for m in request.context.current_meds]
            dummy_allergies = [DummyAllergy(a) for a in request.context.allergies]
            extracted_medications_planned = []
            new_diagnosis_displays = []
            
            encounter = None # Bypass persistence
            allergies = dummy_allergies
            active_meds = dummy_active_meds
        else:
            encounter = db.query(Encounter).filter(Encounter.id == request.encounter_id).first()
            if not encounter:
                raise ValueError(f"Encounter with ID {request.encounter_id} not found")

            patient_id = encounter.patient_id
            allergies = db.query(Allergy).filter(Allergy.patient_id == patient_id).all()
            active_meds = db.query(Medication).filter(Medication.patient_id == patient_id, Medication.is_active == True).all()
            recent_labs = (
                db.query(LabResult)
                .filter(LabResult.patient_id == patient_id)
                .order_by(LabResult.result_date.desc())
                .limit(10)
                .all()
            )

            extracted_entities = encounter.extracted_entities if isinstance(encounter.extracted_entities, dict) else {}
            soap_note = encounter.soap_note if isinstance(encounter.soap_note, dict) else {}

            extracted_medications_planned = []
            meds_planned_raw = extracted_entities.get("medications_planned") or extracted_entities.get("medications") or []
            if isinstance(meds_planned_raw, list):
                for m in meds_planned_raw:
                    if isinstance(m, dict) and m.get("name"):
                        extracted_medications_planned.append(m["name"])
                    elif isinstance(m, str):
                        extracted_medications_planned.append(m)

            extracted_diagnoses = extracted_entities.get("diagnoses") or []
            new_diagnosis_displays: List[str] = []
            if isinstance(extracted_diagnoses, list):
                for d in extracted_diagnoses:
                    if isinstance(d, dict) and d.get("display"):
                        new_diagnosis_displays.append(str(d["display"]))
                    elif isinstance(d, str):
                        new_diagnosis_displays.append(d)

            prompt_context = {
                "soap_note": soap_note,
                "patient_history": {
                    "known_allergies": [{"substance": a.substance, "reaction": a.reaction, "severity": a.severity} for a in allergies],
                    "active_medications": [{"name": m.name, "dosage": m.dosage, "frequency": m.frequency, "route": m.route} for m in active_meds],
                    "recent_labs": [{"test_name": l.test_name, "value": l.value, "flag": l.flag, "date": str(l.result_date)} for l in recent_labs],
                    "diagnoses_from_note": new_diagnosis_displays,
                },
                "new_medications_planned": extracted_medications_planned,
            }
            disable_llm = (os.environ.get("OMNICARE_DISABLE_LLM") == "1") or (not settings.google_api_key)

        # LLM path
        disable_llm_flag = (os.environ.get("OMNICARE_DISABLE_LLM") == "1") or (not settings.google_api_key)
        if disable_llm_flag:
            resp = self._heuristic_cds(
                encounter,
                allergies,
                active_meds,
                extracted_medications_planned,
                new_diagnosis_displays,
            )
            if not request.context:
                self._persist(db, encounter, resp)
            return resp

        try:
            client = genai.Client(api_key=settings.google_api_key)
            response_schema = {
                "type": "OBJECT",
                "properties": {
                    "cds_alerts": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "id": {"type": "STRING"},
                                "type": {"type": "STRING"},
                                "severity": {"type": "STRING"},
                                "message": {"type": "STRING"},
                                "source": {"type": "STRING"},
                                "requires_acknowledgement": {"type": "BOOLEAN"},
                                "suggested_action": {"type": "STRING"},
                            },
                            "required": ["id", "type", "severity", "message", "requires_acknowledgement"],
                        },
                    },
                    "confidence_score": {"type": "NUMBER"},
                },
                "required": ["cds_alerts", "confidence_score"],
            }
            response = client.models.generate_content(
                model=self.model_name,
                contents=json.dumps(prompt_context),
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )
            raw = response.text or ""
            data = json.loads(raw) if raw else {}
            alerts = [CDSAlert(**a) for a in data.get("cds_alerts", [])]
            conf = float(data.get("confidence_score") or 0.45)
            resp = CDSResponse(cds_alerts=alerts, confidence_score=conf)
            if not request.context:
                self._persist(db, encounter, resp)
            return resp
        except Exception:
            # Heuristic fallback (keeps the pipeline moving).
            resp = self._heuristic_cds(encounter, allergies, active_meds, extracted_medications_planned, new_diagnosis_displays)
            if not request.context:
                self._persist(db, encounter, resp)
            return resp

    def _heuristic_cds(
        self,
        encounter: Encounter,
        allergies,
        active_meds,
        extracted_medications_planned: List[str],
        diagnosis_displays: List[str],
    ) -> CDSResponse:
        alerts: List[CDSAlert] = []

        allergy_substances = [a.substance for a in allergies if a.substance]
        meds_all = [m.name for m in active_meds if m.name] + list(extracted_medications_planned)

        # Drug-allergy (simple substring match).
        for allergy_sub in allergy_substances:
            for med in meds_all:
                if allergy_sub and med and allergy_sub.strip().lower() in med.strip().lower():
                    alerts.append(
                        CDSAlert(
                            id=f"alert-{uuid.uuid4()}",
                            type="drug_allergy",
                            severity="CRITICAL",
                            message=f"Planned/active medication '{med}' may conflict with allergy '{allergy_sub}'. Verify before prescribing.",
                            source="Offline heuristic",
                            requires_acknowledgement=True,
                            suggested_action="Confirm allergy details and consider an alternative medication.",
                        )
                    )
                    break

        # Example interaction.
        planned_lower = {m.lower() for m in extracted_medications_planned if m}
        if "warfarin" in planned_lower and any(m.lower() == "aspirin" or "aspirin" in m.lower() for m in planned_lower.union({mm.name.lower() for mm in active_meds})):
            alerts.append(
                CDSAlert(
                    id=f"alert-{uuid.uuid4()}",
                    type="drug_interaction",
                    severity="WARNING",
                    message="Aspirin + Warfarin combination can increase bleeding risk. Consider gastroprotection and close monitoring.",
                    source="Offline heuristic",
                    requires_acknowledgement=True,
                    suggested_action="Assess bleeding risk; consider PPI and check INR per protocol.",
                )
            )

        # Screening reminders (very small set).
        diag_text = " ".join(diagnosis_displays).lower()
        if "diabetes" in diag_text or "hba1c" in diag_text:
            alerts.append(
                CDSAlert(
                    id=f"alert-{uuid.uuid4()}",
                    type="screening_reminder",
                    severity="INFO",
                    message="Diabetes appears in the assessment. Ensure periodic screening (e.g., annual eye exam, foot exam).",
                    source="Offline heuristic",
                    requires_acknowledgement=False,
                    suggested_action="If not up to date, schedule diabetes-related screening.",
                )
            )

        return CDSResponse(cds_alerts=alerts, confidence_score=0.25 if alerts else 0.15)

    def _persist(self, db: Session, encounter: Encounter, resp: CDSResponse) -> None:
        # Keep encounter.cds_alerts aligned with the prompt output.
        encounter.cds_alerts = [a.model_dump() for a in resp.cds_alerts]
        encounter.status = EncounterStatusEnum.review
        db.add(encounter)
        db.commit()

