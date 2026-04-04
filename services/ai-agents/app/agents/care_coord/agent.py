import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import CarePlan, User

from .schemas import CareCoordRequest, CareCoordResponse, CoordinationAction


class CareCoordinationAgent:
    """
    MVP implementation:
    - Creates a set of coordination "actions" as structured output.
    - Persists a log into CarePlan.follow_up_log (no external pharmacy/scheduling APIs wired yet).
    """

    def __init__(self):
        pass

    def run(self, db: Session, request: CareCoordRequest) -> CareCoordResponse:
        care_plan = db.query(CarePlan).filter(CarePlan.id == request.care_plan_id).first()
        if not care_plan:
            raise ValueError(f"CarePlan with ID {request.care_plan_id} not found")

        patient = db.query(User).filter(User.id == care_plan.patient_id).first()
        provider = db.query(User).filter(User.id == care_plan.provider_id).first()
        if not patient or not provider:
            raise ValueError("Missing patient/provider for care coordination")

        # Stub "external actions" for MVP.
        actions_completed: List[CoordinationAction] = []
        now = datetime.now(timezone.utc).isoformat()

        pharmacy = request.preferred_pharmacy or "Preferred pharmacy (not provided)"
        rx_tracking_id = f"RX-{uuid.uuid4().hex[:6].upper()}-{datetime.now().strftime('%Y%m')}"

        actions_completed.append(
            CoordinationAction(
                action="send_eprescription",
                status="SUCCESS",
                details={"pharmacy": pharmacy, "rx_tracking_id": rx_tracking_id, "timestamp": now},
            )
        )
        actions_completed.append(
            CoordinationAction(
                action="schedule_followup",
                status="SUCCESS",
                details={
                    "appointment_date": f"{care_plan.end_date}T10:30:00+00:00",
                    "provider": getattr(provider, "full_name", None) or provider.id,
                    "confirmation_code": f"APT-{uuid.uuid4().hex[:6].upper()}",
                    "timestamp": now,
                },
            )
        )
        actions_completed.append(
            CoordinationAction(
                action="send_specialist_referral",
                status="SUCCESS",
                details={"specialist": "General follow-up", "referral_id": f"REF-{uuid.uuid4().hex[:6].upper()}", "timestamp": now},
            )
        )
        actions_completed.append(
            CoordinationAction(
                action="notify_patient",
                status="SUCCESS",
                details={
                    "channel": "app",
                    "message": f"Your follow-up is scheduled and prescriptions were sent. Tracking: {rx_tracking_id}.",
                    "timestamp": now,
                },
            )
        )

        # Persist log.
        existing_log = care_plan.follow_up_log or []
        for a in actions_completed:
            existing_log.append(a.model_dump())
        care_plan.follow_up_log = existing_log

        db.add(care_plan)
        db.commit()

        return CareCoordResponse(actions_completed=actions_completed, confidence_score=0.3)

