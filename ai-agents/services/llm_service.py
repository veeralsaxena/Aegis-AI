import asyncio
import json
import os
import re

import httpx
from dotenv import load_dotenv

from services.gemini_support import gemini_api_key, gemini_model_id

load_dotenv()

SOAP_SYSTEM_PROMPT = """You are a clinical documentation assistant. Given a transcript of a doctor-patient consultation, extract and structure a SOAP note.

Return ONLY valid JSON in this exact format, no other text:
{
  "subjective": "Patient's chief complaint, symptoms, history as described by patient. Include onset, duration, character, severity, alleviating/aggravating factors.",
  "objective": "Clinical findings mentioned: vitals, examination findings, lab results referenced. If not mentioned, write 'Not documented in this encounter.'",
  "assessment": "Doctor's diagnosis or working diagnosis. Include ICD-10 code if diagnosable from context.",
  "plan": "Treatment plan, medications prescribed, investigations ordered, follow-up instructions, referrals."
}

Rules:
- Write in third person clinical language (e.g. 'Patient reports...' not 'I have...')
- Do not invent findings not mentioned in the transcript
- Keep each field concise but complete
- If the conversation is in a mix of Hindi and English, translate everything to English in the output
"""

CONSULTATION_DRAFT_SYSTEM_PROMPT = """You are an ambient clinical documentation assistant embedded in a consultation workflow.

You are given a transcript of a doctor-patient conversation and some EMR context. Produce an editable clinical draft that a doctor will review before anything is committed to the chart.

Important constraints:
- Return ONLY valid JSON. No markdown. No explanation.
- Do not invent facts that are not supported by the transcript.
- If speaker attribution is uncertain, use "unknown" and lower confidence.
- Infer likely doctor vs patient turns using dialogue cues only. This is heuristic role inference, not ground-truth diarization.
- Translate mixed Hindi/English into clean English output.
- Prefer concise, clinically useful phrasing.
- Only include medications/labs/diagnoses that are explicitly discussed or clearly intended.
- For medications, extract dose, route, frequency, duration only when stated. Otherwise leave blank.

Return this exact JSON shape:
{
  "visit_summary": "2-3 sentence plain-English summary of the encounter",
  "soap": {
    "subjective": "",
    "objective": "",
    "assessment": "",
    "plan": ""
  },
  "speaker_analysis": {
    "method": "heuristic_role_inference_from_transcript",
    "confidence": "high|moderate|low",
    "notes": "brief explanation of why the role inference is or is not reliable"
  },
  "speaker_turns": [
    {
      "speaker": "doctor|patient|unknown",
      "confidence": "high|moderate|low",
      "text": "sequential excerpt of the transcript"
    }
  ],
  "suggestions": {
    "diagnoses": [
      {
        "name": "diagnosis text",
        "order": "PRIMARY|SECONDARY",
        "certainty": "CONFIRMED|PRESUMED",
        "evidence": "short transcript-based reason"
      }
    ],
    "medications": [
      {
        "name": "drug name",
        "dose": "",
        "dose_units": "mg|ml|g|mcg|IU|Tablet(s)|Capsule(s)|",
        "route": "Oral|Intravenous|Intramuscular|Subcutaneous|Topical|Inhalation|Rectal|",
        "frequency": "Once a day|Twice a day|Thrice a day|Four times a day|Every 6 hours|Every 8 hours|Every 12 hours|Immediately|",
        "duration": "",
        "duration_units": "Day(s)|Week(s)|Month(s)|",
        "instructions": "",
        "status": "new|continue|stop|unclear",
        "evidence": "short transcript-based reason"
      }
    ],
    "lab_orders": [
      {
        "name": "lab or investigation name",
        "urgency": "ROUTINE|STAT",
        "evidence": "short transcript-based reason"
      }
    ],
    "disposition": {
      "action": "ADMIT|DISCHARGE|TRANSFER|REFER|NONE",
      "note": ""
    },
    "follow_up": "follow-up advice if discussed, else empty string",
    "patient_instructions": [
      "short instruction"
    ],
    "red_flags": [
      "important concern or caution"
    ]
  }
}
"""


def _parse_json_block(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _coerce_str(value: object, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def _coerce_choice(value: object, allowed: set[str], default: str) -> str:
    text = _coerce_str(value, default).upper()
    return text if text in allowed else default


def _normalize_consultation_draft(raw: dict) -> dict:
    raw = raw or {}
    soap = raw.get("soap") if isinstance(raw.get("soap"), dict) else {}
    speaker_analysis = (
        raw.get("speaker_analysis")
        if isinstance(raw.get("speaker_analysis"), dict)
        else {}
    )
    suggestions = raw.get("suggestions") if isinstance(raw.get("suggestions"), dict) else {}

    speaker_turns = []
    for turn in raw.get("speaker_turns") or []:
        if not isinstance(turn, dict):
            continue
        text = _coerce_str(turn.get("text"))
        if not text:
            continue
        speaker_turns.append(
            {
                "speaker": _coerce_choice(
                    turn.get("speaker"),
                    {"DOCTOR", "PATIENT", "UNKNOWN"},
                    "UNKNOWN",
                ).lower(),
                "confidence": _coerce_choice(
                    turn.get("confidence"),
                    {"HIGH", "MODERATE", "LOW"},
                    "MODERATE",
                ).lower(),
                "text": text,
            }
        )

    diagnoses = []
    for item in suggestions.get("diagnoses") or []:
        if not isinstance(item, dict):
            continue
        name = _coerce_str(item.get("name"))
        if not name:
            continue
        diagnoses.append(
            {
                "name": name,
                "order": _coerce_choice(
                    item.get("order"),
                    {"PRIMARY", "SECONDARY"},
                    "PRIMARY",
                ),
                "certainty": _coerce_choice(
                    item.get("certainty"),
                    {"CONFIRMED", "PRESUMED"},
                    "PRESUMED",
                ),
                "evidence": _coerce_str(item.get("evidence")),
            }
        )

    medications = []
    for item in suggestions.get("medications") or []:
        if not isinstance(item, dict):
            continue
        name = _coerce_str(item.get("name"))
        if not name:
            continue
        medications.append(
            {
                "name": name,
                "dose": _coerce_str(item.get("dose")),
                "dose_units": _coerce_str(item.get("dose_units")),
                "route": _coerce_str(item.get("route")),
                "frequency": _coerce_str(item.get("frequency")),
                "duration": _coerce_str(item.get("duration")),
                "duration_units": _coerce_str(item.get("duration_units")),
                "instructions": _coerce_str(item.get("instructions")),
                "status": _coerce_choice(
                    item.get("status"),
                    {"NEW", "CONTINUE", "STOP", "UNCLEAR"},
                    "UNCLEAR",
                ).lower(),
                "evidence": _coerce_str(item.get("evidence")),
            }
        )

    lab_orders = []
    for item in suggestions.get("lab_orders") or []:
        if not isinstance(item, dict):
            continue
        name = _coerce_str(item.get("name"))
        if not name:
            continue
        lab_orders.append(
            {
                "name": name,
                "urgency": _coerce_choice(
                    item.get("urgency"),
                    {"ROUTINE", "STAT"},
                    "ROUTINE",
                ),
                "evidence": _coerce_str(item.get("evidence")),
            }
        )

    disposition = (
        suggestions.get("disposition")
        if isinstance(suggestions.get("disposition"), dict)
        else {}
    )

    return {
        "visit_summary": _coerce_str(raw.get("visit_summary")),
        "soap": {
            "subjective": _coerce_str(
                soap.get("subjective"),
                "Not documented in this encounter.",
            ),
            "objective": _coerce_str(
                soap.get("objective"),
                "Not documented in this encounter.",
            ),
            "assessment": _coerce_str(
                soap.get("assessment"),
                "Not documented in this encounter.",
            ),
            "plan": _coerce_str(
                soap.get("plan"),
                "Not documented in this encounter.",
            ),
        },
        "speaker_analysis": {
            "method": "heuristic_role_inference_from_transcript",
            "confidence": _coerce_choice(
                speaker_analysis.get("confidence"),
                {"HIGH", "MODERATE", "LOW"},
                "MODERATE",
            ).lower(),
            "notes": _coerce_str(
                speaker_analysis.get("notes"),
                "Role attribution was inferred from conversational cues.",
            ),
        },
        "speaker_turns": speaker_turns[:12],
        "suggestions": {
            "diagnoses": diagnoses[:6],
            "medications": medications[:8],
            "lab_orders": lab_orders[:8],
            "disposition": {
                "action": _coerce_choice(
                    disposition.get("action"),
                    {"ADMIT", "DISCHARGE", "TRANSFER", "REFER", "NONE"},
                    "NONE",
                ),
                "note": _coerce_str(disposition.get("note")),
            },
            "follow_up": _coerce_str(suggestions.get("follow_up")),
            "patient_instructions": [
                _coerce_str(item)
                for item in (suggestions.get("patient_instructions") or [])
                if _coerce_str(item)
            ][:8],
            "red_flags": [
                _coerce_str(item)
                for item in (suggestions.get("red_flags") or [])
                if _coerce_str(item)
            ][:8],
        },
    }


def _build_context_block(patient_context: dict | None = None) -> str:
    if not patient_context:
        return ""
    return f"""
Patient context (from EMR records):
- Age: {patient_context.get('age', 'unknown')}
- Sex: {patient_context.get('sex', 'unknown')}
- Active conditions: {', '.join(patient_context.get('conditions', [])) or 'None on record'}
- Current medications: {', '.join(patient_context.get('medications', [])) or 'None on record'}
"""


def _normalize_transcript_text(transcript: str) -> str:
    text = (transcript or "").strip()
    replacements = {
        r"\bhas been you\b": "has dengue",
        r"\bhave been you\b": "have dengue",
        r"\bbeen you\b": "dengue",
        r"\bplate let\b": "platelet",
        r"\bplaylet\b": "platelet",
        r"\bparacitamol\b": "paracetamol",
        r"\bparasitamol\b": "paracetamol",
        r"\bacethromycin\b": "azithromycin",
        r"\bacithromycin\b": "azithromycin",
        r"\bazethromycin\b": "azithromycin",
        r"\bazithromicin\b": "azithromycin",
        r"\b101 degree\b": "101 degrees",
        r"\bcentigrade\b": "celsius",
        r"\bpain along the chest area\b": "chest pain",
    }
    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    text = re.sub(r"([.?!])\1+", r"\1", text)
    text = re.sub(r"\s+", " ", text)

    units = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    deduped: list[str] = []
    seen: set[str] = set()
    for unit in units:
        key = re.sub(r"\s+", " ", unit.lower()).strip(" .")
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(unit)
    return " ".join(deduped).strip()


def _normalize_failure_note(note: str | None) -> str:
    text = (note or "").strip()
    lower = text.lower()
    if "429" in text or "quota" in lower:
        return "Gemini API quota exceeded"
    return text[:160] if text else "local fallback"


def _split_transcript_units(transcript: str) -> list[str]:
    transcript = _normalize_transcript_text(transcript)
    lines = [line.strip() for line in transcript.splitlines() if line.strip()]
    if len(lines) >= 2:
        return lines
    parts = re.split(r"(?<=[.!?])\s+", transcript.strip())
    return [part.strip() for part in parts if part.strip()]


def _infer_speaker_label(text: str) -> tuple[str, str]:
    lowered = text.lower().strip()
    if re.match(r"^(doctor|dr\.?|clinician|provider)\s*:", lowered):
        return "doctor", "high"
    if re.match(r"^(patient|pt\.?)\s*:", lowered):
        return "patient", "high"
    patient_cues = [
        "i have",
        "i am",
        "i've",
        "my pain",
        "my fever",
        "my cough",
        "since yesterday",
        "for two days",
        "it hurts",
        "i feel",
    ]
    doctor_cues = [
        "take ",
        "start ",
        "continue ",
        "we will",
        "i will prescribe",
        "blood test",
        "x-ray",
        "follow up",
        "come back",
        "you should",
        "i think",
        "most likely",
    ]
    if any(cue in lowered for cue in patient_cues):
        return "patient", "moderate"
    if any(cue in lowered for cue in doctor_cues) or lowered.endswith("?"):
        return "doctor", "moderate"
    return "unknown", "low"


def _clean_medication_name(name: str) -> str:
    cleaned = (name or "").strip(" .,:;")
    cleaned = re.sub(
        r"^(?:the\s+patient|this\s+patient|patient|him|her|them|the)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.split(
        r"\b(?:for|and|with|because|if|then|after|before|while)\b",
        cleaned,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip(" .,:;")
    cleaned = re.sub(r"\s+", " ", cleaned)
    words = cleaned.split()
    if len(words) > 4:
        cleaned = " ".join(words[:4]).strip()
    return cleaned


def _format_medication_summary(med: dict) -> str:
    parts = [med.get("name", "").strip()]
    if med.get("dose"):
        dose = med["dose"]
        if med.get("dose_units"):
            dose = f"{dose} {med['dose_units']}".strip()
        parts.append(dose)
    if med.get("frequency"):
        parts.append(med["frequency"])
    if med.get("duration"):
        duration = med["duration"]
        if med.get("duration_units"):
            duration = f"{duration} {med['duration_units']}".strip()
        parts.append(f"for {duration}".strip())
    summary = " ".join(part for part in parts if part).strip()
    return summary or med.get("name", "").strip()


def _extract_medication_suggestions(transcript: str) -> list[dict]:
    transcript = _normalize_transcript_text(transcript)
    meds: list[dict] = []
    pattern = re.compile(
        r"(?:plan\s+is\s+to\s+|we\s+will\s+|will\s+|going\s+to\s+|advise(?:d)?\s+to\s+)?"
        r"(?:prescribe|start|give|take|continue|administer|begin)\s+"
        r"(?:the\s+patient\s+|patient\s+|him\s+|her\s+|them\s+)?"
        r"([A-Za-z][A-Za-z0-9 +/\-]{1,50}?)"
        r"(?:\s+(\d+(?:\.\d+)?))?"
        r"(?:\s*(mg|ml|g|mcg|iu|tablet(?:s)?|capsule(?:s)?))?"
        r"(?:.*?(once a day|twice a day|thrice a day|every 6 hours|every 8 hours|every 12 hours))?"
        r"(?:.*?for\s+(\d+)\s+(day|days|week|weeks|month|months))?",
        re.IGNORECASE,
    )
    for match in pattern.finditer(transcript):
        name = _clean_medication_name(match.group(1) or "")
        if not name or len(name) < 3:
            continue
        duration_unit = (match.group(6) or "").lower()
        if duration_unit.startswith("day"):
            duration_unit = "Day(s)"
        elif duration_unit.startswith("week"):
            duration_unit = "Week(s)"
        elif duration_unit.startswith("month"):
            duration_unit = "Month(s)"
        else:
            duration_unit = ""
        meds.append(
            {
                "name": name,
                "dose": (match.group(2) or "").strip(),
                "dose_units": (match.group(3) or "").replace("iu", "IU").strip(),
                "route": "",
                "frequency": (match.group(4) or "").title(),
                "duration": (match.group(5) or "").strip(),
                "duration_units": duration_unit,
                "instructions": "",
                "status": "new",
                "evidence": f"Extracted from transcript: {match.group(0).strip()[:140]}",
            }
        )
    deduped: list[dict] = []
    seen: set[str] = set()
    for med in meds:
        key = med["name"].lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(med)
    dose_pattern = re.compile(
        r"\b([A-Z][a-zA-Z]+)\s+(\d+(?:\.\d+)?)\s*(mg|ml|g|mcg|iu)\b",
        re.IGNORECASE,
    )
    for match in dose_pattern.finditer(transcript):
        name = (match.group(1) or "").strip()
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(
            {
                "name": name,
                "dose": (match.group(2) or "").strip(),
                "dose_units": (match.group(3) or "").replace("iu", "IU").strip(),
                "route": "",
                "frequency": "",
                "duration": "",
                "duration_units": "",
                "instructions": "",
                "status": "new",
                "evidence": f"Detected medication with dose in transcript: {match.group(0).strip()}",
            }
        )
    suffix_pattern = re.compile(
        r"\b([A-Za-z]{4,}(?:mycin|cillin|floxacin|azole|olol|pril|sartan|vir|navir|setron|formin|zepam|fenac|mol|xime|xone|clav|cycline|tidine))\b",
        re.IGNORECASE,
    )
    for match in suffix_pattern.finditer(transcript):
        name = _clean_medication_name(match.group(1) or "")
        key = name.lower()
        if len(name) < 4 or key in seen:
            continue
        seen.add(key)
        deduped.append(
            {
                "name": name,
                "dose": "",
                "dose_units": "",
                "route": "",
                "frequency": "",
                "duration": "",
                "duration_units": "",
                "instructions": "",
                "status": "new",
                "evidence": f"Medication name mentioned in transcript: {name}",
            }
        )
    return deduped[:8]


def _extract_lab_orders(transcript: str) -> list[dict]:
    labs: list[dict] = []
    lab_patterns = [
        ("CBC", r"\bcbc\b|complete blood count"),
        ("Blood sugar", r"\bblood sugar\b|\bglucose\b"),
        ("HbA1c", r"\bhba1c\b"),
        ("Urine routine", r"\burine\b"),
        ("Chest X-ray", r"chest x-?ray|x-?ray chest"),
        ("ECG", r"\becg\b|\bekg\b"),
    ]
    lowered = transcript.lower()
    for name, pattern in lab_patterns:
        if re.search(pattern, lowered):
            labs.append(
                {
                    "name": name,
                    "urgency": "ROUTINE",
                    "evidence": f"Discussed in transcript: {name}",
                }
            )
    return labs[:8]


def _extract_temperature_mentions(sentences: list[str]) -> list[str]:
    output: list[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if re.search(r"\b\d{2,3}\s*(degrees?|degree)\s*(celsius|fahrenheit|f|c)?\b", lowered):
            output.append(sentence.strip())
    return output[:3]


def _extract_diagnosis_labels(transcript: str) -> list[str]:
    diagnosis_patterns = {
        "Dengue": r"\bdengue\b",
        "Malaria": r"\bmalaria\b",
        "Typhoid": r"\btyphoid\b",
        "Viral fever": r"\bviral fever\b",
        "Pneumonia": r"\bpneumonia\b",
        "Urinary tract infection": r"\buti\b|\burinary tract infection\b",
        "Diabetes mellitus": r"\bdiabetes\b",
        "Hypertension": r"\bhypertension\b",
        "Anemia": r"\banemia\b",
    }
    lowered = transcript.lower()
    found = [label for label, pattern in diagnosis_patterns.items() if re.search(pattern, lowered)]
    return found[:4]


def _extract_subjective_facts(transcript: str) -> list[str]:
    lowered = transcript.lower()
    facts: list[str] = []
    if "chest pain" in lowered or "pain along the chest" in lowered or "pain in the chest" in lowered:
        facts.append("Chest pain reported.")
    if "fever" in lowered:
        temp_match = re.search(
            r"\b(\d{2,3})\s*(degrees?|degree)\s*(celsius|fahrenheit|f|c)?\b",
            transcript,
            re.IGNORECASE,
        )
        if temp_match:
            unit = (temp_match.group(3) or "degrees").strip()
            facts.append(f"Fever reported, up to {temp_match.group(1)} {unit}.")
        else:
            facts.append("Fever reported.")
    for label, pattern in [
        ("Cough", r"\bcough\b"),
        ("Breathlessness", r"\bshortness of breath\b|\bbreathless\b"),
        ("Headache", r"\bheadache\b"),
        ("Vomiting", r"\bvomiting\b"),
        ("Body ache", r"\bbody ache\b|\bbody pain\b"),
    ]:
        if re.search(pattern, lowered) and f"{label} reported." not in facts:
            facts.append(f"{label} reported.")
    return facts[:5]


def _extract_objective_facts(transcript: str) -> list[str]:
    lowered = transcript.lower()
    facts: list[str] = []
    if re.search(r"\bplatelet(?: count)?\b.*\blow\b", lowered):
        facts.append("Platelet count is low.")
    temp_match = re.search(
        r"\b(\d{2,3})\s*(degrees?|degree)\s*(celsius|fahrenheit|f|c)?\b",
        transcript,
        re.IGNORECASE,
    )
    if temp_match:
        unit = (temp_match.group(3) or "degrees").strip()
        facts.append(f"Temperature documented as {temp_match.group(1)} {unit}.")
    if re.search(r"\b(bp|blood pressure)\b.*\b(high|low|\d{2,3}/\d{2,3})", lowered):
        facts.append("Blood pressure finding mentioned in transcript.")
    if re.search(r"\b(wbc|hemoglobin|hb|creatinine|glucose|sugar)\b", lowered):
        facts.append("Laboratory result was discussed.")
    return facts[:5]


def _extract_plan_sentences(sentences: list[str]) -> list[str]:
    plan_cues = [
        "plan",
        "prescribe",
        "start",
        "continue",
        "give ",
        "administer",
        "take ",
        "repeat ",
        "follow up",
        "come back",
        "return if",
        "drink ",
        "rest",
        "admit",
        "discharge",
        "x-ray",
        "ecg",
        "cbc",
        "blood test",
    ]
    output: list[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(cue in lowered for cue in plan_cues):
            output.append(sentence.strip())
    return output[:5]


def _is_placeholder_text(text: str) -> bool:
    lowered = (text or "").strip().lower()
    if not lowered:
        return True
    placeholders = [
        "not documented in this encounter",
        "no explicit examination finding",
        "diagnosis or clinical impression was not clearly stated",
        "no treatment plan was explicitly documented",
        "symptoms were mentioned but need clinician review",
        "not documented",
        "not clearly stated",
        "no plan discussed",
    ]
    return any(phrase in lowered for phrase in placeholders)


def _merge_consultation_drafts(primary: dict, fallback: dict) -> dict:
    merged = json.loads(json.dumps(primary))
    for section in ("subjective", "objective", "assessment", "plan"):
        primary_value = _coerce_str(merged.get("soap", {}).get(section))
        fallback_value = _coerce_str(fallback.get("soap", {}).get(section))
        if _is_placeholder_text(primary_value) and fallback_value and not _is_placeholder_text(fallback_value):
            merged["soap"][section] = fallback_value

    if _is_placeholder_text(_coerce_str(merged.get("visit_summary"))):
        merged["visit_summary"] = fallback.get("visit_summary", merged.get("visit_summary", ""))

    primary_suggestions = merged.get("suggestions", {})
    fallback_suggestions = fallback.get("suggestions", {})
    for key in ("diagnoses", "medications", "lab_orders", "patient_instructions", "red_flags"):
        if not primary_suggestions.get(key) and fallback_suggestions.get(key):
            primary_suggestions[key] = fallback_suggestions[key]

    if not _coerce_str(primary_suggestions.get("follow_up")) and _coerce_str(fallback_suggestions.get("follow_up")):
        primary_suggestions["follow_up"] = fallback_suggestions["follow_up"]

    if primary_suggestions.get("disposition", {}).get("action") in ("", "NONE") and fallback_suggestions.get("disposition", {}).get("action") not in ("", "NONE", None):
        primary_suggestions["disposition"] = fallback_suggestions["disposition"]

    if not merged.get("speaker_turns") and fallback.get("speaker_turns"):
        merged["speaker_turns"] = fallback["speaker_turns"]

    return merged


def _build_visit_summary(
    subjective: str,
    objective: str,
    assessment: str,
    plan: str,
) -> str:
    parts = []
    if subjective:
        parts.append(subjective)
    if objective and objective not in subjective:
        parts.append(objective)
    if assessment:
        parts.append(f"Clinical impression: {assessment}")
    if plan:
        parts.append(f"Plan: {plan}")
    summary = " ".join(parts).strip()
    return summary[:420] if summary else "Consultation captured and summarized for clinician review."


def _extract_disposition(transcript: str) -> dict:
    lowered = transcript.lower()
    if "admit" in lowered:
        return {"action": "ADMIT", "note": "Admission was discussed in the transcript."}
    if "discharge" in lowered:
        return {"action": "DISCHARGE", "note": "Discharge was discussed in the transcript."}
    if "refer" in lowered:
        return {"action": "REFER", "note": "Referral was discussed in the transcript."}
    if "transfer" in lowered:
        return {"action": "TRANSFER", "note": "Transfer was discussed in the transcript."}
    return {"action": "NONE", "note": ""}


def _extract_objective_sentences(sentences: list[str]) -> list[str]:
    objective_cues = [
        "platelet",
        "count",
        "bp",
        "blood pressure",
        "pulse",
        "temperature",
        "cbc",
        "wbc",
        "hb",
        "hemoglobin",
        "creatinine",
        "sugar",
        "glucose",
        "spo2",
        "oxygen",
        "exam",
        "examination",
        "positive",
        "negative",
        "low",
        "high",
        "rash",
        "celsius",
        "fahrenheit",
        "degrees",
    ]
    output: list[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(cue in lowered for cue in objective_cues):
            output.append(sentence.strip())
    output.extend(_extract_temperature_mentions(sentences))
    return _dedupe_sentences(output)[:4]


def _extract_assessment_sentences(sentences: list[str]) -> list[str]:
    assessment_patterns = [
        r"\b(has|have|diagnosed with|diagnosis is|likely|most likely|consistent with|suggestive of)\b",
        r"\b(dengue|malaria|typhoid|viral fever|pneumonia|diabetes|hypertension|anemia|uti|tuberculosis)\b",
    ]
    output: list[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(re.search(pattern, lowered) for pattern in assessment_patterns):
            output.append(sentence.strip())
    return output[:3]


def _extract_subjective_sentences(sentences: list[str]) -> list[str]:
    subjective_cues = [
        "complains",
        "complaint",
        "reports",
        "since",
        "pain",
        "chest pain",
        "cough",
        "fever",
        "vomiting",
        "nausea",
        "headache",
        "body ache",
        "weakness",
    ]
    output: list[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(cue in lowered for cue in ["follow up", "continue ", "repeat ", "cbc"]):
            continue
        if any(cue in lowered for cue in subjective_cues):
            output.append(sentence.strip())
    return output[:4]


def _dedupe_sentences(sentences: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for sentence in sentences:
        key = sentence.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(sentence.strip())
    return output


def _heuristic_consultation_draft(
    transcript: str,
    patient_context: dict | None = None,
    speaker_turns_hint: list[dict] | None = None,
    failure_note: str | None = None,
) -> dict:
    transcript = _normalize_transcript_text(transcript)
    cleaned_sentences = _split_transcript_units(transcript)
    turns: list[dict] = []
    raw_turns = speaker_turns_hint or []
    if raw_turns:
        for turn in raw_turns:
            text = str(turn.get("text") or "").strip()
            if not text:
                continue
            speaker = str(turn.get("speaker") or "unknown").lower()
            confidence = str(turn.get("confidence") or "moderate").lower()
            if speaker not in ("doctor", "patient", "unknown"):
                speaker = "unknown"
            if confidence not in ("high", "moderate", "low"):
                confidence = "moderate"
            turns.append({"speaker": speaker, "confidence": confidence, "text": text})
    else:
        for unit in _split_transcript_units(transcript):
            speaker, confidence = _infer_speaker_label(unit)
            turns.append({"speaker": speaker, "confidence": confidence, "text": unit})

    patient_bits = [t["text"] for t in turns if t["speaker"] == "patient"]
    doctor_bits = [t["text"] for t in turns if t["speaker"] == "doctor"]
    unknown_bits = [t["text"] for t in turns if t["speaker"] == "unknown"]

    subjective_sentences = _dedupe_sentences(
        _extract_subjective_sentences(patient_bits or cleaned_sentences)
    )
    objective_sentences = _dedupe_sentences(
        _extract_objective_sentences(doctor_bits + unknown_bits + cleaned_sentences)
    )
    diagnosis_labels = _extract_diagnosis_labels(transcript)
    assessment_sentences = _dedupe_sentences(
        _extract_assessment_sentences(doctor_bits + unknown_bits + cleaned_sentences)
    )

    subjective_facts = _extract_subjective_facts(transcript)
    objective_facts = _extract_objective_facts(transcript)
    subjective = " ".join(subjective_facts[:4]).strip() or " ".join(subjective_sentences[:4]).strip()
    objective = " ".join(objective_facts[:4]).strip() or " ".join(objective_sentences[:4]).strip()
    assessment = ", ".join(diagnosis_labels[:2]).strip() or " ".join(assessment_sentences[:2]).strip()

    if not assessment:
        assessment_match = re.search(
            r"(?:diagnosis|impression|likely|most likely|assessment)\s*(?:is|:)?\s*([^.!\n]+)",
            transcript,
            re.IGNORECASE,
        )
        assessment = assessment_match.group(1).strip() if assessment_match else ""

    if not subjective:
        symptom_sentences = [
            sentence
            for sentence in cleaned_sentences
            if not any(
                cue in sentence.lower()
                for cue in ["follow up", "continue ", "repeat ", "cbc"]
            )
        ]
        subjective = " ".join(_dedupe_sentences(symptom_sentences)[:2]).strip()
    medications = _extract_medication_suggestions(transcript)
    lab_orders = _extract_lab_orders(transcript)
    disposition = _extract_disposition(transcript)
    plan_candidates = _extract_plan_sentences(doctor_bits + unknown_bits + cleaned_sentences)
    plan_parts = _dedupe_sentences(plan_candidates[:4])
    if medications:
        med_plan = "; ".join(
            f"Start { _format_medication_summary(med) }.".strip()
            for med in medications[:3]
            if med.get("name")
        )
        if med_plan:
            plan_parts.append(med_plan)
    if lab_orders:
        lab_plan = ", ".join(order["name"] for order in lab_orders[:3] if order.get("name"))
        if lab_plan:
            plan_parts.append(f"Investigations planned: {lab_plan}.")
    plan = " ".join(_dedupe_sentences(plan_parts)).strip()

    follow_up = ""
    match = re.search(r"(follow up[^.!\n]*)", transcript, re.IGNORECASE)
    if match:
        follow_up = match.group(1).strip()

    patient_instructions = []
    for text in doctor_bits + unknown_bits:
        lowered = text.lower()
        if any(cue in lowered for cue in ["take ", "drink ", "rest", "avoid ", "come back", "return if"]):
            patient_instructions.append(text.strip())
    patient_instructions = patient_instructions[:6]

    diagnoses = []
    for label in diagnosis_labels:
        diagnoses.append(
            {
                "name": label,
                "order": "PRIMARY" if not diagnoses else "SECONDARY",
                "certainty": "PRESUMED",
                "evidence": f"Mentioned directly in transcript: {label}",
            }
        )
    if assessment and not diagnoses:
        diagnoses.append(
            {
                "name": assessment,
                "order": "PRIMARY",
                "certainty": "PRESUMED",
                "evidence": "Inferred from transcript phrasing in the assessment/impression.",
            }
        )

    visit_summary = _build_visit_summary(subjective, objective, assessment, plan)

    notes = "Role attribution was inferred from transcript cues."
    if speaker_turns_hint:
        notes = "Speaker turns came from the transcription pipeline."
    if failure_note:
        notes = f"{notes} LLM fallback used because: {_normalize_failure_note(failure_note)}"

    return {
        "visit_summary": visit_summary or "Consultation captured and summarized for clinician review.",
        "soap": {
            "subjective": subjective or "Symptoms were mentioned but need clinician review before charting.",
            "objective": objective or "No explicit examination finding, vital sign, or lab value was clearly documented.",
            "assessment": assessment or "Diagnosis or clinical impression was not clearly stated.",
            "plan": plan or "No treatment plan was explicitly documented in the transcript.",
        },
        "speaker_analysis": {
            "method": "heuristic_role_inference_from_transcript",
            "confidence": "moderate" if patient_bits or doctor_bits else "low",
            "notes": notes,
        },
        "speaker_turns": turns[:12],
        "suggestions": {
            "diagnoses": diagnoses[:6],
            "medications": medications,
            "lab_orders": lab_orders,
            "disposition": disposition,
            "follow_up": follow_up,
            "patient_instructions": patient_instructions,
            "red_flags": [],
        },
    }


def _run_json_generation(
    *,
    system_prompt: str,
    user_message: str,
    max_output_tokens: int,
) -> dict:
    gkey = gemini_api_key()
    if gkey:
        import httpx

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model_id()}:generateContent?key={gkey}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "maxOutputTokens": max_output_tokens,
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
        return _parse_json_block(raw)

    if os.getenv("ANTHROPIC_API_KEY"):
        import anthropic

        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        response = client.messages.create(
            model=model,
            max_tokens=max_output_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = response.content[0].text
        return _parse_json_block(raw)

    if os.getenv("OPENAI_API_KEY"):
        import openai

        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_output_tokens,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        return _parse_json_block(raw)

    try:
        r = httpx.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": f"{system_prompt}\n\n{user_message}",
                "stream": False,
                "format": "json",
            },
            timeout=120.0,
        )
        r.raise_for_status()
        raw = (r.json() or {}).get("response") or "{}"
    except Exception as e:
        raise RuntimeError(
            "No LLM configured: set GOOGLE_API_KEY (or GEMINI_API_KEY) in ai-agents/.env, "
            "or OPENAI_API_KEY / ANTHROPIC_API_KEY, or start Ollama on localhost:11434."
        ) from e
    return _parse_json_block(raw)


async def generate_consultation_draft_from_transcript(
    transcript: str,
    patient_context: dict | None = None,
    speaker_turns_hint: list[dict] | None = None,
) -> dict:
    context_block = _build_context_block(patient_context)
    turns_block = ""
    if speaker_turns_hint:
        serialized_turns = "\n".join(
            f"- {str(turn.get('speaker') or 'unknown').lower()}: {str(turn.get('text') or '').strip()}"
            for turn in speaker_turns_hint
            if str(turn.get("text") or "").strip()
        )
        if serialized_turns:
            turns_block = f"""
Speaker-turn hints from transcription:
{serialized_turns}
"""
    user_message = f"""
{context_block}
{turns_block}
Consultation transcript:
---
{transcript}
---

Generate the consultation draft JSON now.
"""

    try:
        heuristic = _heuristic_consultation_draft(
            transcript,
            patient_context=patient_context,
            speaker_turns_hint=speaker_turns_hint,
        )
        raw = await asyncio.to_thread(
            _run_json_generation,
            system_prompt=CONSULTATION_DRAFT_SYSTEM_PROMPT,
            user_message=user_message,
            max_output_tokens=4096,
        )
        normalized = _normalize_consultation_draft(raw)
        normalized = _merge_consultation_drafts(normalized, heuristic)
        if speaker_turns_hint and not normalized.get("speaker_turns"):
            normalized["speaker_turns"] = speaker_turns_hint[:12]
        return normalized
    except Exception as e:
        return _heuristic_consultation_draft(
            transcript,
            patient_context=patient_context,
            speaker_turns_hint=speaker_turns_hint,
            failure_note=str(e)[:200],
        )


async def generate_soap_from_transcript(
    transcript: str, patient_context: dict | None = None
) -> dict:
    context_block = _build_context_block(patient_context)
    user_message = f"""
{context_block}
Consultation transcript:
---
{transcript}
---

Generate the SOAP note JSON now.
"""

    try:
        return await asyncio.to_thread(
            _run_json_generation,
            system_prompt=SOAP_SYSTEM_PROMPT,
            user_message=user_message,
            max_output_tokens=2048,
        )
    except Exception:
        return _heuristic_consultation_draft(
            transcript,
            patient_context=patient_context,
        )["soap"]
