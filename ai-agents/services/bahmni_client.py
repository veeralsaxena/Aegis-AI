import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

BAHMNI_BASE = os.getenv("BAHMNI_BASE_URL", "http://localhost:8080").rstrip("/")
AUTH = (
    os.getenv("BAHMNI_USERNAME", "superman"),
    os.getenv("BAHMNI_PASSWORD", "Admin123"),
)


def _obs_value(raw: dict) -> Any:
    if raw is None:
        return None
    if "value" in raw:
        return raw["value"]
    if "valueNumeric" in raw:
        return raw["valueNumeric"]
    if "valueText" in raw:
        return raw["valueText"]
    return None


async def get_patient(patient_uuid: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{BAHMNI_BASE}/openmrs/ws/rest/v1/patient/{patient_uuid}?v=full",
            auth=AUTH,
        )
        r.raise_for_status()
        return r.json()


async def get_latest_obs(patient_uuid: str, concept_name: str, limit: int = 5) -> list:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{BAHMNI_BASE}/openmrs/ws/rest/v1/obs",
            params={
                "patient": patient_uuid,
                "concept": concept_name,
                "limit": limit,
                "v": "full",
            },
            auth=AUTH,
        )
        r.raise_for_status()
        results = r.json().get("results", [])
        normalized = []
        for row in results:
            normalized.append(
                {
                    "value": _obs_value(row),
                    "obsDatetime": row.get("obsDatetime"),
                    "uuid": row.get("uuid"),
                }
            )
        return normalized


async def get_active_drug_orders(patient_uuid: str) -> list:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{BAHMNI_BASE}/openmrs/ws/rest/v1/order",
            params={
                "patient": patient_uuid,
                "careSetting": "OUTPATIENT",
                "v": "full",
            },
            auth=AUTH,
        )
        if r.status_code == 404:
            return []
        r.raise_for_status()
        orders = r.json().get("results", [])
        active = []
        for o in orders:
            if not o.get("drug"):
                continue
            if o.get("dateStopped"):
                continue
            st = (o.get("status") or "").upper()
            t = (o.get("type") or "").lower()
            if t == "drugorder" or "drug" in t or st in ("ACTIVE", ""):
                active.append(o)
        return active


async def get_active_conditions(patient_uuid: str) -> list:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{BAHMNI_BASE}/openmrs/ws/rest/v1/condition",
            params={"patientUuid": patient_uuid, "v": "full"},
            auth=AUTH,
        )
        if r.status_code >= 400:
            return []
        data = r.json()
        return data.get("results", data) if isinstance(data, dict) else data


async def get_vitals(patient_uuid: str) -> dict:
    vital_concepts = [
        "Systolic blood pressure",
        "Diastolic blood pressure",
        "Pulse",
        "Temperature (C)",
        "Respiratory rate",
        "Arterial blood oxygen saturation (pulse oximetry)",
        "Weight (kg)",
        "Height (cm)",
    ]
    vitals: dict = {}
    async with httpx.AsyncClient(timeout=30.0) as client:
        for concept in vital_concepts:
            r = await client.get(
                f"{BAHMNI_BASE}/openmrs/ws/rest/v1/obs",
                params={
                    "patient": patient_uuid,
                    "concept": concept,
                    "limit": 1,
                    "v": "custom:(value,valueNumeric,valueText,obsDatetime)",
                },
                auth=AUTH,
            )
            if r.status_code >= 400:
                continue
            results = r.json().get("results", [])
            if results:
                row = results[0]
                vitals[concept] = {
                    "value": _obs_value(row),
                    "date": row.get("obsDatetime"),
                }
    return vitals


async def post_observation_alert(
    patient_uuid: str,
    encounter_uuid: Optional[str],
    alert_text: str,
    concept_uuid: str,
) -> dict:
    payload = {
        "person": patient_uuid,
        "obsDatetime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "concept": concept_uuid,
        "value": alert_text,
    }
    if encounter_uuid:
        payload["encounter"] = encounter_uuid
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{BAHMNI_BASE}/openmrs/ws/rest/v1/obs",
            json=payload,
            auth=AUTH,
        )
        return r.json()
