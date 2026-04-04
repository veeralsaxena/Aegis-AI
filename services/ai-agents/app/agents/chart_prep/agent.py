import json
from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User, Encounter, Medication, LabResult, Allergy, RoleEnum

from .schemas import ChartPrepRequest, ChartPrepResponse, PreVisitSummary
from .prompts import SYSTEM_PROMPT

class ChartPrepAgent:
    def __init__(self):
        self.model_name = "gemini-3-flash-preview" # Switched to 1.5-flash due to API 'limit: 0' Free Tier quotas on 2.0

    def run(self, db: Session, request: ChartPrepRequest) -> ChartPrepResponse:
        # We use the new google-genai version 1.3.0 interface
        client = genai.Client(api_key=settings.google_api_key)
        if request.context:
            patient_history_context = self._format_from_context(request.context)
        else:
            patient = db.query(User).filter(User.id == request.patient_id, User.role == RoleEnum.PATIENT).first()
            if not patient:
                raise ValueError(f"Patient with ID {request.patient_id} not found")
            
            # Fetch Medical History
            allergies = db.query(Allergy).filter(Allergy.patient_id == request.patient_id).all()
            medications = db.query(Medication).filter(Medication.patient_id == request.patient_id, Medication.is_active == True).all()
            labs = db.query(LabResult).filter(LabResult.patient_id == request.patient_id).order_by(LabResult.result_date.desc()).limit(10).all()
            encounters = db.query(Encounter).filter(Encounter.patient_id == request.patient_id).order_by(Encounter.scheduled_at.desc()).limit(3).all()

            patient_history_context = self._format_patient_history(patient, allergies, medications, labs, encounters)

        prompt = f"Patient Record Data:\n\n{patient_history_context}"
        
        # Setup structured output for Gemini
        response_schema = {
            "type": "OBJECT",
            "properties": {
                "active_problems": {"type": "ARRAY", "items": {"type": "STRING"}},
                "current_medications": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "frequency": {"type": "STRING"},
                            "last_prescribed": {"type": "STRING"}
                        }
                    }
                },
                "recent_abnormal_labs": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "test": {"type": "STRING"},
                            "value": {"type": "STRING"},
                            "date": {"type": "STRING"},
                            "flag": {"type": "STRING"}
                        }
                    }
                },
                "open_referrals": {"type": "ARRAY", "items": {"type": "STRING"}},
                "allergies": {"type": "ARRAY", "items": {"type": "STRING"}},
                "last_visit_reason": {"type": "STRING"},
                "flags": {"type": "ARRAY", "items": {"type": "STRING"}}
            },
            "required": ["active_problems", "current_medications", "recent_abnormal_labs", "open_referrals", "allergies", "last_visit_reason", "flags"]
        }

        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=response_schema
                )
            )
            
            structured_data = json.loads(response.text)
            
            return ChartPrepResponse(
                pre_visit_summary=PreVisitSummary(**structured_data),
                confidence_score=0.95, # In a real implementation this could be calculated based on data availability
                sources_fetched=["omnicare_db"]
            )
            
        except Exception as e:
            raise RuntimeError(f"Failed to generate chart prep summary: {str(e)}")

    def _format_patient_history(self, patient, allergies, medications, labs, encounters):
        history = [
            f"Patient: {patient.full_name} ({patient.gender.value if patient.gender else 'unknown'}), DOB: {patient.date_of_birth.strftime('%Y-%m-%d') if patient.date_of_birth else 'unknown'}",
            f"ABHA ID: {patient.abha_id or 'None'}\n"
        ]
        
        history.append("--- ALLERGIES ---")
        if allergies:
            for al in allergies:
                history.append(f"- {al.substance}: {al.reaction} (Severity: {al.severity})")
        else:
            history.append("No known allergies.")
            
        history.append("\n--- ACTIVE MEDICATIONS ---")
        if medications:
            for med in medications:
                history.append(f"- {med.name} {med.dosage} {med.route} {med.frequency} (Prescribed: {med.prescribed_date.strftime('%Y-%m-%d') if med.prescribed_date else 'unknown'})")
        else:
            history.append("No active medications.")
            
        history.append("\n--- RECENT LABS ---")
        if labs:
            for lab in labs:
                flag = f" [{lab.flag}]" if lab.flag and lab.flag != 'NORMAL' else ""
                history.append(f"- {lab.result_date.strftime('%Y-%m-%d')} | {lab.test_name}: {lab.value} {lab.unit}{flag} (Ref: {lab.reference_range})")
        else:
            history.append("No recent labs.")
            
        history.append("\n--- PAST ENCOUNTERS ---")
        if encounters:
            for enc in encounters:
                history.append(f"\nDate: {enc.scheduled_at.strftime('%Y-%m-%d') if enc.scheduled_at else 'unknown'}")
                if enc.soap_note:
                    history.append(f"Subjective: {enc.soap_note.get('subjective', '')}")
                    history.append(f"Assessment: {enc.soap_note.get('assessment', '')}")
                    history.append(f"Plan: {enc.soap_note.get('plan', '')}")
                else:
                    history.append("No SOAP note available.")
            
        return "\n".join(history)

    def _format_from_context(self, context) -> str:
        history = [
            f"Patient: {context.full_name} ({context.gender or 'unknown'}), DOB: {context.dob or 'unknown'}\n"
        ]
        
        history.append("--- ALLERGIES ---")
        if context.allergies:
            for al in context.allergies:
                history.append(f"- {al}")
        else:
            history.append("No known allergies.")
            
        history.append("\n--- ACTIVE MEDICATIONS ---")
        if context.medications:
            for med in context.medications:
                history.append(f"- {med.get('name', 'Unknown')} {med.get('dosage', '')} {med.get('frequency', '')} (Prescribed: {med.get('prescribed_date', 'unknown')})")
        else:
            history.append("No active medications.")
            
        history.append("\n--- RECENT LABS ---")
        if context.labs:
            for lab in context.labs:
                history.append(f"- {lab.get('date', 'unknown')} | {lab.get('test_name', 'Unknown')}: {lab.get('value', '')} {lab.get('unit', '')} (Ref: {lab.get('reference_range', '')})")
        else:
            history.append("No recent labs.")
            
        history.append("\n--- PAST ENCOUNTERS ---")
        if context.encounters:
            for enc in context.encounters:
                history.append(f"\nDate: {enc.get('date', 'unknown')}")
                history.append(f"Reason: {enc.get('reason', '')}")
                history.append(f"Notes: {enc.get('notes', '')}")
        else:
            history.append("No previous encounters.")
            
        return "\n".join(history)
