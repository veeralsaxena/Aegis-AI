import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import IS_POSTGRES, get_db
from services.bahmni_client import get_active_conditions, get_active_drug_orders, get_patient
from services.llm_service import generate_consultation_draft_from_transcript
from services.whisper_service import transcribe_audio_with_metadata

# #region agent log
from debug_agent_log import agent_log as _agent_log

# #endregion

logger = logging.getLogger(__name__)
router = APIRouter()


def _persist_soap_draft(
    db: Session,
    draft_id: str,
    patient_uuid: str,
    encounter_uuid: str | None,
    doctor_uuid: str | None,
    transcript: str,
    draft: dict,
    now,
) -> None:
    draft_json = json.dumps(draft)
    try:
        if IS_POSTGRES:
            db.execute(
                text(
                    """
            INSERT INTO soap_drafts (
                id, patient_uuid, encounter_uuid, doctor_uuid, raw_transcript, soap_json, status, created_at
            ) VALUES (
                CAST(:id AS uuid), :patient_uuid, :encounter_uuid, :doctor_uuid, :transcript,
                CAST(:draft AS jsonb), 'draft', :now
            )
            """
                ),
                {
                    "id": draft_id,
                    "patient_uuid": patient_uuid,
                    "encounter_uuid": encounter_uuid,
                    "doctor_uuid": doctor_uuid,
                    "transcript": transcript,
                    "draft": draft_json,
                    "now": now,
                },
            )
        else:
            db.execute(
                text(
                    """
            INSERT INTO soap_drafts (
                id, patient_uuid, encounter_uuid, doctor_uuid, raw_transcript, soap_json, status, created_at
            ) VALUES (
                :id, :patient_uuid, :encounter_uuid, :doctor_uuid, :transcript, :draft, 'draft', :now
            )
            """
                ),
                {
                    "id": draft_id,
                    "patient_uuid": patient_uuid,
                    "encounter_uuid": encounter_uuid,
                    "doctor_uuid": doctor_uuid,
                    "transcript": transcript,
                    "draft": draft_json,
                    "now": now.isoformat(),
                },
            )
        db.commit()
    except Exception as e:
        logger.warning("soap_drafts insert skipped (DB): %s", e)
        db.rollback()


@router.post("/transcribe-and-generate")
async def transcribe_and_generate(
    patient_uuid: str = Form(...),
    encounter_uuid: str | None = Form(None),
    doctor_uuid: str | None = Form(None),
    language: str | None = Form(None),
    transcript: str | None = Form(None),
    audio: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """
    Either send `audio` (recording) or paste `transcript` (>= 20 chars) to skip local Whisper.
    """
    # #region agent log
    _agent_log(
        "H_S0",
        "scribe.py:transcribe_and_generate:entry",
        "handler entered after get_db",
        {
            "patient_uuid_len": len(patient_uuid or ""),
            "transcript_form_len": len((transcript or "").strip()),
            "audio_present": audio is not None,
            "audio_filename": getattr(audio, "filename", None) if audio is not None else None,
        },
    )
    # #endregion
    transcript_stripped = (transcript or "").strip()
    transcription_meta: dict = {}

    if transcript_stripped and len(transcript_stripped) >= 20:
        # #region agent log
        _agent_log("H_S5", "scribe.py:branch", "using pasted transcript path", {"len": len(transcript_stripped)})
        # #endregion
        final_transcript = transcript_stripped
    elif audio is not None:
        audio_bytes = await audio.read()
        # #region agent log
        _agent_log(
            "H_S1",
            "scribe.py:audio_read",
            "audio bytes read",
            {"byte_len": len(audio_bytes) if audio_bytes else 0},
        )
        # #endregion
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(
                status_code=422,
                detail="No usable audio or transcript. Upload audio or paste a transcript (20+ characters).",
            )
        try:
            transcription_meta = await transcribe_audio_with_metadata(
                audio_bytes,
                language=language,
            )
            final_transcript = str(transcription_meta.get("transcript") or "")
            # #region agent log
            _agent_log(
                "H_S1",
                "scribe.py:whisper_ok",
                "transcription finished",
                {
                    "transcript_len": len(final_transcript or ""),
                    "mode": transcription_meta.get("transcription_mode"),
                    "diarization_available": transcription_meta.get(
                        "diarization_available"
                    ),
                },
            )
            # #endregion
        except Exception as e:
            # #region agent log
            _agent_log(
                "H_S1",
                "scribe.py:whisper_err",
                "transcription exception",
                {"exc_type": type(e).__name__, "exc_msg": str(e)[:400]},
            )
            # #endregion
            raise HTTPException(
                status_code=500,
                detail=f"Transcription failed ({e!s}). Paste transcript instead, set WHISPER_MODE=openai with OPENAI_API_KEY, or install faster-whisper dependencies.",
            ) from e
    else:
        # #region agent log
        _agent_log("H_S5", "scribe.py:branch", "no audio and short transcript", {"transcript_len": len(transcript_stripped)})
        # #endregion
        raise HTTPException(
            status_code=422,
            detail="Provide multipart field `audio` or form field `transcript` (at least 20 characters).",
        )

    if not final_transcript or len(final_transcript.strip()) < 20:
        raise HTTPException(
            status_code=422,
            detail="Transcript too short or empty. Speak longer, or paste more text.",
        )

    patient_context: dict = {}
    try:
        patient_data = await get_patient(patient_uuid)
        person = patient_data.get("person", {}) or {}
        patient_context["age"] = person.get("age", "unknown")
        patient_context["sex"] = person.get("gender", "unknown")

        conditions = await get_active_conditions(patient_uuid)
        if not isinstance(conditions, list):
            conditions = []
        patient_context["conditions"] = [
            (c.get("concept") or {}).get("display", "")
            for c in conditions
            if isinstance(c, dict) and not c.get("endDate")
        ]

        drug_orders = await get_active_drug_orders(patient_uuid)
        patient_context["medications"] = [
            o.get("drug", {}).get("display")
            or o.get("concept", {}).get("display", "")
            for o in drug_orders
        ]
    except Exception:
        pass

    try:
        consultation_draft = await generate_consultation_draft_from_transcript(
            final_transcript,
            patient_context,
            speaker_turns_hint=transcription_meta.get("speaker_turns")
            if isinstance(transcription_meta.get("speaker_turns"), list)
            else None,
        )
        # #region agent log
        _agent_log(
            "H_S2",
            "scribe.py:soap_ok",
            "consultation draft generated",
            {
                "keys": list(consultation_draft.keys())
                if isinstance(consultation_draft, dict)
                else []
            },
        )
        # #endregion
    except Exception as e:
        # #region agent log
        _agent_log(
            "H_S2",
            "scribe.py:soap_err",
            "consultation draft generation exception",
            {"exc_type": type(e).__name__, "exc_msg": str(e)[:400]},
        )
        # #endregion
        raise HTTPException(
            status_code=500,
            detail=f"Scribe generation failed: {e!s}. Set GOOGLE_API_KEY / GEMINI_API_KEY or another LLM in ai-agents/.env",
        ) from e

    draft_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    _persist_soap_draft(
        db,
        draft_id,
        patient_uuid,
        encounter_uuid,
        doctor_uuid,
        final_transcript,
        consultation_draft,
        now,
    )

    # #region agent log
    _agent_log("H_S0", "scribe.py:success", "returning 200", {"draft_id_set": True})
    # #endregion
    return {
        "draft_id": draft_id,
        "transcript": final_transcript,
        "soap": consultation_draft.get("soap", {}),
        "draft": consultation_draft,
        "transcription_meta": {
            "mode": transcription_meta.get("transcription_mode"),
            "diarization_available": transcription_meta.get("diarization_available"),
        },
    }


@router.patch("/{draft_id}/accept")
async def accept_draft(
    draft_id: str,
    payload: dict | None = None,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    try:
        reviewed_draft = payload.get("draft") if isinstance(payload, dict) else None
        reviewed_json = (
            json.dumps(reviewed_draft)
            if isinstance(reviewed_draft, dict)
            else None
        )
        if IS_POSTGRES:
            if reviewed_json is not None:
                db.execute(
                    text(
                        """
                UPDATE soap_drafts
                SET status='accepted', accepted_at=:now, soap_json=CAST(:draft AS jsonb)
                WHERE id=CAST(:id AS uuid)
                """
                    ),
                    {"id": draft_id, "now": now, "draft": reviewed_json},
                )
            else:
                db.execute(
                    text(
                        """
                UPDATE soap_drafts SET status='accepted', accepted_at=:now
                WHERE id=CAST(:id AS uuid)
                """
                    ),
                    {"id": draft_id, "now": now},
                )
        else:
            if reviewed_json is not None:
                db.execute(
                    text(
                        """
                UPDATE soap_drafts
                SET status='accepted', accepted_at=:now, soap_json=:draft
                WHERE id=:id
                """
                    ),
                    {"id": draft_id, "now": now.isoformat(), "draft": reviewed_json},
                )
            else:
                db.execute(
                    text(
                        """
                UPDATE soap_drafts SET status='accepted', accepted_at=:now
                WHERE id=:id
                """
                    ),
                    {"id": draft_id, "now": now.isoformat()},
                )
        db.commit()
    except Exception as e:
        logger.warning("accept draft DB update skipped: %s", e)
        db.rollback()
    return {"status": "accepted"}


@router.patch("/{draft_id}/discard")
async def discard_draft(draft_id: str, db: Session = Depends(get_db)):
    try:
        if IS_POSTGRES:
            db.execute(
                text("UPDATE soap_drafts SET status='discarded' WHERE id=CAST(:id AS uuid)"),
                {"id": draft_id},
            )
        else:
            db.execute(
                text("UPDATE soap_drafts SET status='discarded' WHERE id=:id"),
                {"id": draft_id},
            )
        db.commit()
    except Exception as e:
        logger.warning("discard draft DB update skipped: %s", e)
        db.rollback()
    return {"status": "discarded"}
