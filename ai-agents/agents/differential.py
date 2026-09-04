import json
import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import text

from db.database import IS_POSTGRES, SessionLocal

logger = logging.getLogger(__name__)
from services.gemini_support import gemini_api_key, gemini_model_id
from services.bahmni_client import (
    get_active_conditions,
    get_active_drug_orders,
    get_latest_obs,
    get_patient,
    get_vitals,
)

DIFFERENTIAL_SYSTEM_PROMPT = """You are assisting a physician with differential diagnosis support (decision support only).

Given patient information and chief complaint, generate 3-5 ranked differential diagnoses.

Return ONLY valid JSON:
{
  "differentials": [
    {
      "rank": 1,
      "diagnosis": "Full diagnosis name",
      "icd10_hint": "Likely ICD-10 code if known",
      "confidence": "High|Medium|Low",
      "reasoning": "Brief reasoning tied to provided data",
      "red_flags": "Urgent red flags or empty string",
      "recommended_investigations": "Key tests"
    }
  ],
  "clinical_note": "One sentence overall note"
}

Rules:
- Include at least one serious diagnosis to rule out when appropriate.
- Be specific to the data given; do not invent findings.
"""


async def fetch_patient_context_for_differential(patient_uuid: str) -> dict:
    context: dict = {"age": "unknown", "sex": "unknown"}

    try:
        patient_data = await get_patient(patient_uuid)
        person = patient_data.get("person", {}) or {}
        context["age"] = person.get("age", "unknown")
        context["sex"] = person.get("gender", "unknown")
    except Exception:
        pass

    try:
        context["vitals"] = await get_vitals(patient_uuid)
    except Exception:
        context["vitals"] = {}

    try:
        conditions = await get_active_conditions(patient_uuid)
        if not isinstance(conditions, list):
            conditions = []
        context["active_conditions"] = [
            (c.get("concept") or {}).get("display", "")
            for c in conditions
            if isinstance(c, dict)
        ]
    except Exception:
        context["active_conditions"] = []

    try:
        drug_orders = await get_active_drug_orders(patient_uuid)
        context["current_medications"] = [
            o.get("drug", {}).get("display")
            or o.get("concept", {}).get("display", "")
            for o in drug_orders
        ]
    except Exception:
        context["current_medications"] = []

    key_labs = [
        "Hemoglobin",
        "WBC",
        "Creatinine",
        "Blood glucose (fasting)",
        "ALT",
        "AST",
    ]
    context["recent_labs"] = {}
    for concept in key_labs:
        try:
            obs = await get_latest_obs(patient_uuid, concept, limit=1)
            if obs and obs[0].get("value") is not None:
                context["recent_labs"][concept] = obs[0]["value"]
        except Exception:
            pass

    return context


async def lookup_icd10_code(diagnosis_name: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search",
                params={"sf": "code,name", "terms": diagnosis_name, "maxList": 1},
            )
            data = r.json()
            if data and len(data) > 1 and data[1]:
                return str(data[1][0])
    except Exception:
        pass
    return ""


async def run_differential_agent(
    patient_uuid: str,
    chief_complaint: str,
    encounter_uuid: str | None = None,
) -> dict:
    context = await fetch_patient_context_for_differential(patient_uuid)

    vitals_text = ""
    if context.get("vitals"):
        parts = []
        for k, v in context["vitals"].items():
            parts.append(f"{k}: {v.get('value')}")
        vitals_text = ", ".join(parts)

    labs_text = (
        ", ".join(f"{k}: {v}" for k, v in context.get("recent_labs", {}).items())
        or "Not available"
    )

    user_message = f"""Patient:
- Age: {context['age']} | Sex: {context['sex']}
- Chief complaint: {chief_complaint}
- Vitals: {vitals_text or 'Not recorded'}
- Recent labs: {labs_text}
- Active conditions: {', '.join(context.get('active_conditions', [])) or 'None'}
- Current medications: {', '.join(context.get('current_medications', [])) or 'None'}

Generate differential diagnoses now."""

    raw = ""

    def _groq():
        import openai

        client = openai.OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=os.environ["GROQ_API_KEY"],
        )
        model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": DIFFERENTIAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content or "{}"

    def _anthropic():
        import anthropic

        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        response = client.messages.create(
            model=model,
            max_tokens=1500,
            system=DIFFERENTIAL_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text

    def _openai():
        import openai

        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": DIFFERENTIAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content or "{}"

    def _gemini():
        import httpx

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model_id()}:generateContent?key={gemini_api_key()}"
        payload = {
            "system_instruction": {"parts": [{"text": DIFFERENTIAL_SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "maxOutputTokens": 2048,
                "temperature": 0.2
            }
        }
        with httpx.Client() as client:
            resp = client.post(url, json=payload, timeout=60.0)
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            raw = "".join([p.get("text", "") for p in parts])
        else:
            raw = "{}"
        return raw

    if os.getenv("GROQ_API_KEY"):
        import asyncio

        raw = await asyncio.to_thread(_groq)
    elif gemini_api_key():
        import asyncio

        raw = await asyncio.to_thread(_gemini)
    elif os.getenv("ANTHROPIC_API_KEY"):
        import asyncio

        raw = await asyncio.to_thread(_anthropic)
    elif os.getenv("OPENAI_API_KEY"):
        import asyncio

        raw = await asyncio.to_thread(_openai)
    else:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                r = await client.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "llama3",
                        "prompt": f"{DIFFERENTIAL_SYSTEM_PROMPT}\n\n{user_message}",
                        "stream": False,
                        "format": "json",
                    },
                )
                r.raise_for_status()
                raw = (r.json() or {}).get("response", "{}")
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=(
                    "No LLM available: set GOOGLE_API_KEY in ai-agents/.env (or OPENAI/ANTHROPIC), "
                    f"or start Ollama. Details: {e!s}"
                ),
            ) from e

    raw = raw.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    if not raw:
        raise HTTPException(
            status_code=503,
            detail="LLM returned empty output. Set GOOGLE_API_KEY or GEMINI_API_KEY in ai-agents/.env and try GEMINI_MODEL=gemini-1.5-flash if 2.0 fails.",
        )
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Model returned invalid JSON: {e!s}. First 400 chars: {raw[:400]!r}",
        ) from e

    for diff in result.get("differentials", []):
        hint = diff.get("icd10_hint") or ""
        if isinstance(hint, str) and len(hint) >= 3 and hint[0].isalpha():
            diff["icd10_code"] = hint.split(" ")[0] if " " in hint else hint
        else:
            diff["icd10_code"] = await lookup_icd10_code(diff.get("diagnosis", ""))
        if "icd10_hint" in diff:
            del diff["icd10_hint"]

    suggestion_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        inp = json.dumps({"chief_complaint": chief_complaint, **context})
        out = json.dumps(result)
        if IS_POSTGRES:
            db.execute(
                text(
                    """
                INSERT INTO differential_suggestions (
                    id, patient_uuid, encounter_uuid, input_snapshot, suggestions, status, created_at
                ) VALUES (
                    :id, :patient_uuid, :encounter_uuid, CAST(:input AS jsonb), CAST(:suggestions AS jsonb), 'pending', :created_at
                )
                """
                ),
                {
                    "id": suggestion_id,
                    "patient_uuid": patient_uuid,
                    "encounter_uuid": encounter_uuid,
                    "input": inp,
                    "suggestions": out,
                    "created_at": now,
                },
            )
        else:
            db.execute(
                text(
                    """
                INSERT INTO differential_suggestions (
                    id, patient_uuid, encounter_uuid, input_snapshot, suggestions, status, created_at
                ) VALUES (
                    :id, :patient_uuid, :encounter_uuid, :input, :suggestions, 'pending', :created_at
                )
                """
                ),
                {
                    "id": suggestion_id,
                    "patient_uuid": patient_uuid,
                    "encounter_uuid": encounter_uuid,
                    "input": inp,
                    "suggestions": out,
                    "created_at": now.isoformat(),
                },
            )
        db.commit()
    except Exception as e:
        logger.warning("differential_suggestions insert skipped: %s", e)
        db.rollback()
    finally:
        db.close()

    result["suggestion_id"] = suggestion_id
    return result
