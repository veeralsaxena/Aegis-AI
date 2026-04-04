import json
import os
import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CarePlan, CarePlanStatusEnum, Encounter, EncounterTypeEnum, EncounterStatusEnum, Medication, User

from .schemas import (
    FollowUpCarePlanRequest,
    FollowUpCarePlanResponse,
    MedicationOnDischarge,
)


SYSTEM_PROMPT = """You are the OmniCare AI Follow-Up & Care Plan Agent.

You will receive:
- a patient discharge summary,
- discharge_date,
- medications_on_discharge.

Generate a structured 7-day mobile-ready care plan:
- daily_schedule: Day 1-7 each with time-stamped tasks (medication_check, symptom_survey, activity_log, wound_photo if relevant).
- tracking_modules: what modules the patient app should enable (diet, activity, vitals, medication, wound_care).
- triage_thresholds: numeric thresholds for triage (pain_max, temp_max_f, bp_systolic_max).

Return ONLY JSON that matches:
{
  "medications": [...],
  "daily_schedule": [...],
  "tracking_modules": [...],
  "triage_thresholds": { "pain_max": number, "temp_max_f": number, "bp_systolic_max": number, "custom": [] }
}
"""


class FollowUpCarePlanAgent:
    def __init__(self):
        self.model_name = "gemini-3-flash-preview"

    def run(self, db: Session, request: FollowUpCarePlanRequest) -> FollowUpCarePlanResponse:
        # Validate existence of patient/encounter/provider as best-effort.
        patient = db.query(User).filter(User.id == request.patient_id).first()
        if not patient:
            raise ValueError(f"Patient with ID {request.patient_id} not found")

        provider = db.query(User).filter(User.id == request.provider_id).first()
        if not provider:
            raise ValueError(f"Provider with ID {request.provider_id} not found")

        encounter = db.query(Encounter).filter(Encounter.id == request.encounter_id).first()
        if not encounter:
            raise ValueError(f"Encounter with ID {request.encounter_id} not found")

        discharge_date = request.discharge_date
        start_date = discharge_date
        end_date = discharge_date + timedelta(days=7)

        # LLM path (optional). For this MVP we always persist something.
        plan_payload: Optional[Dict[str, Any]] = None
        disable_llm = (os.environ.get("OMNICARE_DISABLE_LLM") == "1") or (not settings.google_api_key)
        try:
            if disable_llm:
                raise RuntimeError("LLM disabled for MVP/test")

            client = genai.Client(api_key=settings.google_api_key)

            response_schema = {
                "type": "OBJECT",
                "properties": {
                    "medications": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING"},
                                "frequency": {"type": "STRING"},
                                "instructions": {"type": "STRING"},
                                "time": {"type": "STRING"},
                            },
                            "required": ["name"],
                        },
                    },
                    "daily_schedule": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "day": {"type": "INTEGER"},
                                "tasks": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "type": {"type": "STRING"},
                                            "time": {"type": "STRING"},
                                            "description": {"type": "STRING"},
                                        },
                                        "required": ["type", "time", "description"],
                                    },
                                },
                            },
                            "required": ["day", "tasks"],
                        },
                    },
                    "tracking_modules": {
                        "type": "ARRAY",
                        "items": {"type": "OBJECT"},
                    },
                    "triage_thresholds": {
                        "type": "OBJECT",
                        "properties": {
                            "pain_max": {"type": "NUMBER"},
                            "temp_max_f": {"type": "NUMBER"},
                            "bp_systolic_max": {"type": "NUMBER"},
                            "custom": {"type": "ARRAY", "items": {}},
                        },
                        "required": ["pain_max", "temp_max_f", "bp_systolic_max", "custom"],
                    },
                },
                "required": ["medications", "daily_schedule", "tracking_modules", "triage_thresholds"],
            }

            meds_for_prompt = [m.model_dump() for m in request.medications_on_discharge]
            contents = json.dumps(
                {
                    "discharge_summary": request.discharge_summary,
                    "discharge_date": str(discharge_date),
                    "medications_on_discharge": meds_for_prompt,
                }
            )

            response = client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )

            raw = response.text or ""
            plan_payload = json.loads(raw) if raw else None
        except Exception:
            plan_payload = None

        if not plan_payload:
            plan_payload = self._fallback_plan_payload(request.discharge_summary, request.medications_on_discharge)
            confidence = 0.2
        else:
            confidence = 0.65

        care_plan = CarePlan(
            patient_id=request.patient_id,
            encounter_id=request.encounter_id,
            provider_id=request.provider_id,
            status=CarePlanStatusEnum.active,
            start_date=start_date,
            end_date=end_date,
            discharge_summary=request.discharge_summary,
            discharge_summary_embedding_id="",  # Pinecone wiring out of scope for MVP
            medications=plan_payload.get("medications") or [],
            daily_schedule=plan_payload.get("daily_schedule") or [],
            tracking_modules=plan_payload.get("tracking_modules") or [],
            triage_thresholds=plan_payload.get("triage_thresholds") or {},
            follow_up_log=[],
            escalation_history=[],
        )

        db.add(care_plan)
        db.commit()

        return FollowUpCarePlanResponse(
            care_plan_id=care_plan.id,
            start_date=str(start_date),
            end_date=str(end_date),
            medications=care_plan.medications or [],
            daily_schedule=care_plan.daily_schedule or [],
            tracking_modules=care_plan.tracking_modules or [],
            triage_thresholds=care_plan.triage_thresholds or {},
            confidence_score=confidence,
        )

    def _fallback_plan_payload(
        self, discharge_summary: str, medications_on_discharge: List[MedicationOnDischarge]
    ) -> Dict[str, Any]:
        discharge_summary_lower = (discharge_summary or "").lower()
        likely_has_wound_care = any(k in discharge_summary_lower for k in ["wound", "surgical", "incision", "staple", "suture"])

        meds_out: List[Dict[str, Any]] = []
        for m in medications_on_discharge:
            freq = m.frequency or "Once daily"
            time = self._infer_time_from_frequency(freq)
            meds_out.append(
                {
                    "name": m.name,
                    "frequency": freq,
                    "time": time,
                    "instructions": m.instructions or f"Take {freq.lower()}.",
                }
            )

        default_thresholds = {
            "pain_max": 7,
            "temp_max_f": 101.5,
            "bp_systolic_max": 180,
            "custom": [],
        }

        daily_schedule: List[Dict[str, Any]] = []
        for day in range(1, 8):
            tasks: List[Dict[str, str]] = [
                {"type": "medication_check", "time": "08:00", "description": "Take your morning medications and confirm adherence."},
                {"type": "symptom_survey", "time": "10:00", "description": "Record pain level and temperature; answer any symptom questions."},
                {"type": "activity_log", "time": "18:00", "description": "Log steps/activity and any notes for the care team."},
            ]
            if likely_has_wound_care and day in (1, 2, 3):
                tasks.insert(
                    1,
                    {
                        "type": "wound_photo",
                        "time": "10:30",
                        "description": "Upload a photo of your wound/incision (if applicable).",
                    },
                )

            daily_schedule.append({"day": day, "tasks": tasks})

        tracking_modules: List[Dict[str, Any]] = [
            {"module": "medication", "config": {}},
            {"module": "vitals", "config": {"pain": True, "temperature_f": True}},
            {"module": "activity", "config": {"steps": True}},
            {"module": "diet", "config": {}},
        ]
        if likely_has_wound_care:
            tracking_modules.append({"module": "wound_care", "config": {}})

        return {
            "medications": meds_out,
            "daily_schedule": daily_schedule,
            "tracking_modules": tracking_modules,
            "triage_thresholds": default_thresholds,
        }

    def _infer_time_from_frequency(self, freq: str) -> str:
        freq_lower = (freq or "").lower()
        if "twice" in freq_lower or "b i d" in freq_lower or "bid" in freq_lower:
            return "08:00, 20:00"
        if "three" in freq_lower:
            return "08:00, 14:00, 20:00"
        return "08:00"

