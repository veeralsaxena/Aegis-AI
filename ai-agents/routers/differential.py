from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from agents.differential import run_differential_agent
from db.database import IS_POSTGRES, SessionLocal

router = APIRouter()


@router.post("/suggest")
async def suggest_differentials(payload: dict):
    if not payload.get("patient_uuid") or not payload.get("chief_complaint"):
        raise HTTPException(
            status_code=422, detail="patient_uuid and chief_complaint required"
        )
    cc = payload["chief_complaint"].strip()
    if len(cc) < 5:
        raise HTTPException(status_code=422, detail="Chief complaint too short")

    return await run_differential_agent(
        patient_uuid=payload["patient_uuid"],
        chief_complaint=cc,
        encounter_uuid=payload.get("encounter_uuid"),
    )


@router.patch("/{suggestion_id}/select")
async def select_diagnosis(suggestion_id: str, payload: dict):
    db = SessionLocal()
    try:
        if IS_POSTGRES:
            db.execute(
                text(
                    """
                UPDATE differential_suggestions
                SET status='accepted', selected_diagnosis=:diagnosis
                WHERE id=CAST(:id AS uuid)
                """
                ),
                {"id": suggestion_id, "diagnosis": payload.get("selected_diagnosis")},
            )
        else:
            db.execute(
                text(
                    """
                UPDATE differential_suggestions
                SET status='accepted', selected_diagnosis=:diagnosis
                WHERE id=:id
                """
                ),
                {"id": suggestion_id, "diagnosis": payload.get("selected_diagnosis")},
            )
        db.commit()
    finally:
        db.close()
    return {"status": "accepted"}


@router.patch("/{suggestion_id}/dismiss")
async def dismiss_suggestions(suggestion_id: str):
    db = SessionLocal()
    try:
        if IS_POSTGRES:
            db.execute(
                text(
                    "UPDATE differential_suggestions SET status='dismissed' WHERE id=CAST(:id AS uuid)"
                ),
                {"id": suggestion_id},
            )
        else:
            db.execute(
                text(
                    "UPDATE differential_suggestions SET status='dismissed' WHERE id=:id"
                ),
                {"id": suggestion_id},
            )
        db.commit()
    finally:
        db.close()
    return {"status": "dismissed"}
