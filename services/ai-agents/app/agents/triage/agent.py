import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import CarePlan

from .schemas import (
    BloodPressure,
    MedicationAdherenceItem,
    TriageDetails,
    TriageRequest,
    TriageResponse,
)


RED_KEYWORDS = [
    "can't breathe",
    "can not breathe",
    "shortness of breath",
    "bleeding",
    "incision site",
    "severe pain",
    "can't walk",
    "can't move",
    "faint",
    "unconscious",
]

AMBER_KEYWORDS = [
    "fever",
    "dizzy",
    "nausea",
    "vomit",
    "worsening",
    "drainage",
]


class TriageAgent:
    def __init__(self):
        pass

    def run(self, db: Session, request: TriageRequest) -> TriageResponse:
        care_plan = db.query(CarePlan).filter(CarePlan.id == request.care_plan_id).first()
        if not care_plan:
            raise ValueError(f"CarePlan with ID {request.care_plan_id} not found")

        thresholds = care_plan.triage_thresholds or {}
        pain_max = float(thresholds.get("pain_max", 7))
        temp_max_f = float(thresholds.get("temp_max_f", 101.5))
        bp_systolic_max = float(thresholds.get("bp_systolic_max", 180))

        submission = request.submission
        risk_factors: List[str] = []
        escalated = False

        # Pain threshold evaluation.
        triage_score = 0
        if submission.pain_level is not None:
            if submission.pain_level > pain_max:
                risk_factors.append(f"Pain level ({submission.pain_level}) exceeds threshold ({pain_max})")
                triage_score += 50
                if submission.pain_level >= pain_max + 2:
                    triage_score += 30

        # Temperature threshold evaluation.
        if submission.temperature_f is not None:
            if submission.temperature_f > temp_max_f:
                risk_factors.append(
                    f"Temperature ({submission.temperature_f}F) exceeds threshold ({temp_max_f}F)"
                )
                triage_score += 40
                if submission.temperature_f >= temp_max_f + 1:
                    triage_score += 20

        # Blood pressure evaluation.
        if submission.blood_pressure and submission.blood_pressure.systolic is not None:
            if submission.blood_pressure.systolic > bp_systolic_max:
                risk_factors.append(
                    f"Systolic BP ({submission.blood_pressure.systolic}) exceeds threshold ({bp_systolic_max})"
                )
                triage_score += 30

        # Free text keyword evaluation.
        notes = (submission.free_text_notes or "").lower()
        if notes:
            for kw in RED_KEYWORDS:
                if kw.lower() in notes:
                    risk_factors.append(f"High-risk keyword detected: '{kw}'")
                    triage_score += 60
                    break
            else:
                for kw in AMBER_KEYWORDS:
                    if kw.lower() in notes:
                        risk_factors.append(f"Mild/moderate concern keyword detected: '{kw}'")
                        triage_score += 30
                        break

        # Missed medications evaluation.
        missed = [m for m in submission.medication_adherence if m.taken is False]
        if missed:
            miss_names = ", ".join([m.medication_name for m in missed][:3])
            risk_factors.append(f"Missed medications reported: {miss_names}")
            triage_score += 25
            if "antibiotic" in miss_names.lower():
                triage_score += 10

        # Determine triage result.
        # - Keep thresholds intentionally simple for MVP determinism.
        triage_result = "GREEN"
        recommended_action = "Stay on schedule and contact your care team if symptoms worsen."

        if any(k in " ".join(risk_factors).lower() for k in ["High-risk keyword", "bleeding", "can't breathe", "severe pain", "incision site"]):
            triage_result = "RED"
            escalated = True
            recommended_action = "We are concerned. Your care team has been notified and will contact you urgently."
        elif triage_score >= 50:
            triage_result = "AMBER"
            recommended_action = "Please keep your phone nearby. We recommend follow-up questions/review."

        if triage_result == "GREEN":
            patient_message = "Thanks for your check-in. Everything looks stable based on the information provided."
        elif triage_result == "AMBER":
            patient_message = (
                "Thanks for your check-in. We have flagged your responses for your care team to review. "
                "Please keep your phone nearby."
            )
        else:
            patient_message = (
                "URGENT: Based on your check-in, we need to escalate to your care team. "
                "If you feel in immediate danger, call your local emergency number."
            )

        triage_details = TriageDetails(
            risk_factors=risk_factors,
            recommended_action=recommended_action,
            escalated=escalated,
        )
        resp = TriageResponse(
            triage_result=triage_result,
            triage_details=triage_details,
            patient_message=patient_message,
        )

        self._persist(db, care_plan, resp, request)
        return resp

    def _persist(self, db: Session, care_plan: CarePlan, resp: TriageResponse, request: TriageRequest) -> None:
        now = datetime.now(timezone.utc).isoformat()
        existing_log: List[Dict[str, Any]] = care_plan.follow_up_log or []
        entry = {
            "type": "triage",
            "timestamp": now,
            "submission_date": str(request.submission.submission_date),
            "day_number": request.submission.day_number,
            "triage_result": resp.triage_result,
            "triage_details": resp.triage_details.model_dump(),
        }
        existing_log.append(entry)
        care_plan.follow_up_log = existing_log

        if resp.triage_result == "RED":
            existing_escalation: List[Dict[str, Any]] = care_plan.escalation_history or []
            existing_escalation.append(
                {
                    "timestamp": now,
                    "trigger": "triage_agent_red",
                    "severity": "CRITICAL",
                    "action_taken": "notify_provider_and_escalate",
                }
            )
            care_plan.escalation_history = existing_escalation

        db.add(care_plan)
        db.commit()

