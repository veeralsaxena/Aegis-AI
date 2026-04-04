import json
import os
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CarePlan

from .schemas import RagChatRequest, RagChatResponse


SYSTEM_PROMPT = """You are the OmniCare AI Post-Discharge RAG Chatbot.

You will be given a patient's care plan context (discharge summary, medications, daily schedule, triage thresholds).
Answer the patient's question using ONLY the provided context.

Rules:
- Do not invent new medical instructions.
- If the context does not contain enough information, say so and recommend contacting the care team.
- Keep the answer clear and patient-friendly.

Return ONLY JSON matching the schema.
"""


class PostDischargeRagAgent:
    def __init__(self):
        self.model_name = "gemini-3-flash-preview"

    def run(self, db: Session, request: RagChatRequest) -> RagChatResponse:
        care_plan = db.query(CarePlan).filter(CarePlan.id == request.care_plan_id).first()
        if not care_plan:
            raise ValueError(f"CarePlan with ID {request.care_plan_id} not found")

        context = self._build_context(care_plan)

        # LLM path
        disable_llm = (os.environ.get("OMNICARE_DISABLE_LLM") == "1") or (not settings.google_api_key)
        if disable_llm:
            return self._fallback_answer(context, request.message)

        try:
            client = genai.Client(api_key=settings.google_api_key)
            response_schema: Dict[str, Any] = {
                "type": "OBJECT",
                "properties": {
                    "answer": {"type": "STRING"},
                    "confidence_score": {"type": "NUMBER"},
                    "recommended_next_step": {"type": "STRING"},
                    "sources": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
                "required": ["answer", "confidence_score", "sources"],
            }

            payload = {"question": request.message, "context": context}
            response = client.models.generate_content(
                model=self.model_name,
                contents=json.dumps(payload),
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )
            raw = response.text or ""
            data = json.loads(raw) if raw else {}
            recommended_next_step = data.get("recommended_next_step")
            sources = data.get("sources") or []
            return RagChatResponse(
                answer=data.get("answer") or "",
                confidence_score=float(data.get("confidence_score") or 0.4),
                recommended_next_step=recommended_next_step,
                sources=sources if isinstance(sources, list) else [str(sources)],
            )
        except Exception:
            return self._fallback_answer(context, request.message)

    def _build_context(self, care_plan: CarePlan) -> Dict[str, Any]:
        medications = care_plan.medications or []
        daily_schedule = care_plan.daily_schedule or []
        triage_thresholds = care_plan.triage_thresholds or {}
        discharge_summary = care_plan.discharge_summary or ""

        # Keep context compact: include top-level summary + meds + thresholds + today's tasks if available.
        context: Dict[str, Any] = {
            "discharge_summary": discharge_summary,
            "medications": medications,
            "daily_schedule": daily_schedule,
            "triage_thresholds": triage_thresholds,
        }
        return context

    def _fallback_answer(self, context: Dict[str, Any], question: str) -> RagChatResponse:
        msg = (question or "").lower()
        sources: List[str] = ["discharge_summary", "medications", "daily_schedule", "triage_thresholds"]

        if "alcohol" in msg:
            # Very generic guidance; avoid prescribing.
            answer = (
                "Your discharge instructions include a medications schedule. Alcohol can interact with some medicines. "
                "To stay safe, please avoid alcohol until you confirm with your care team."
            )
            return RagChatResponse(
                answer=answer,
                confidence_score=0.2,
                recommended_next_step="Contact your care team to confirm whether alcohol is safe with your specific medications.",
                sources=sources,
            )

        # Default: point to discharge summary.
        return RagChatResponse(
            answer=(
                "I'm not fully sure from your saved discharge instructions. "
                "Please contact your care team for personalized guidance."
            ),
            confidence_score=0.15,
            recommended_next_step="Message your care team or call the clinic if symptoms are concerning.",
            sources=sources,
        )

