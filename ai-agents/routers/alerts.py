import json
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import IS_SQLITE, get_db

router = APIRouter()

active_connections: dict[str, list[WebSocket]] = {}


def _id_where_clause() -> str:
    return "id = :id" if IS_SQLITE else "id = CAST(:id AS uuid)"


def _update_sql(status: str, extra_set: str = "") -> str:
    set_clause = f"status='{status}'"
    if extra_set:
        set_clause = f"{set_clause}, {extra_set}"
    return (
        "UPDATE agent_alerts "
        f"SET {set_clause}, doctor_uuid=:doctor, resolved_at=:now "
        f"WHERE {_id_where_clause()}"
    )


@router.websocket("/ws/{patient_uuid}")
async def websocket_endpoint(websocket: WebSocket, patient_uuid: str):
    await websocket.accept()
    active_connections.setdefault(patient_uuid, []).append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        conns = active_connections.get(patient_uuid, [])
        if websocket in conns:
            conns.remove(websocket)


async def push_alert_to_ui(patient_uuid: str, alerts: list[dict]):
    conns = list(active_connections.get(patient_uuid, []))
    if not conns:
        return
    message = json.dumps({"type": "new_alerts", "alerts": alerts})
    dead: list[WebSocket] = []
    for ws in conns:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in active_connections.get(patient_uuid, []):
            active_connections[patient_uuid].remove(ws)


def _row_to_alert(row: Any) -> dict:
    d = dict(row._mapping)
    if d.get("created_at") and hasattr(d["created_at"], "isoformat"):
        d["created_at"] = d["created_at"].isoformat()
    return d


@router.get("/{patient_uuid}")
async def get_alerts(
    patient_uuid: str,
    status: str = "active",
    db: Session = Depends(get_db),
):
    result = db.execute(
        text(
            """
            SELECT id, agent_name, severity, title, body, rule_fired, status, created_at
            FROM agent_alerts
            WHERE patient_uuid = :uuid AND status = :status
            ORDER BY created_at DESC
            """
        ),
        {"uuid": patient_uuid, "status": status},
    )
    return [_row_to_alert(row) for row in result]


@router.post("/check-drug")
async def check_drug(payload: dict):
    patient_uuid = payload.get("patient_uuid")
    drug_name = payload.get("drug_name")
    if not patient_uuid or not drug_name:
        return {"alerts": [], "count": 0, "error": "patient_uuid and drug_name required"}

    try:
        from agents.drug_safety_agent import run_drug_safety_agent
    except ImportError as e:
        return {
            "alerts": [],
            "count": 0,
            "error": (
                "Drug safety agent unavailable (install deps: pip install -r requirements.txt). "
                f"Import error: {e!s}"
            ),
        }

    alerts = await run_drug_safety_agent(
        patient_uuid=patient_uuid,
        drug_name=drug_name,
        encounter_uuid=payload.get("encounter_uuid"),
    )

    concept_uuid = os.getenv("AI_CLINICAL_ALERT_CONCEPT_UUID")
    if alerts and concept_uuid:
        from services.bahmni_client import post_observation_alert

        for a in alerts:
            try:
                await post_observation_alert(
                    patient_uuid,
                    payload.get("encounter_uuid"),
                    f"{a.get('title')}: {a.get('body', '')[:500]}",
                    concept_uuid,
                )
            except Exception:
                pass

    if alerts:
        await push_alert_to_ui(patient_uuid, alerts)

    return {"alerts": alerts, "count": len(alerts)}


@router.patch("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    payload: dict | None = None,
    db: Session = Depends(get_db),
):
    payload = payload or {}
    now = datetime.now(timezone.utc)
    db.execute(
        text(_update_sql("acknowledged")),
        {"id": alert_id, "doctor": payload.get("doctor_uuid"), "now": now},
    )
    db.commit()
    return {"status": "acknowledged"}


@router.patch("/{alert_id}/override")
async def override_alert(alert_id: str, payload: dict, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    db.execute(
        text(_update_sql("overridden", "override_reason=:reason")),
        {
            "id": alert_id,
            "reason": payload.get("reason", ""),
            "doctor": payload.get("doctor_uuid"),
            "now": now,
        },
    )
    db.commit()
    return {"status": "overridden"}
