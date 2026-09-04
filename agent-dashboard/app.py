from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

import requests
import streamlit as st

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None


ROOT = Path(__file__).resolve().parents[1]
AI_ENV = ROOT / "ai-agents" / ".env"
ROOT_ENV = ROOT / ".env"

if load_dotenv:
    load_dotenv(AI_ENV)
    load_dotenv(ROOT_ENV)

AI_BASE_URL = os.getenv("AI_AGENT_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
DB_PATH = Path(os.getenv("AI_AGENT_DB_PATH", str(ROOT / "ai-agents" / "ai_agents_local.db")))

st.set_page_config(
    page_title="Neuro-Sentinel",
    page_icon="🩺",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
      #MainMenu, header, footer, [data-testid="stToolbar"], [data-testid="stDecoration"], [data-testid="stStatusWidget"] {
        visibility: hidden !important;
        display: none !important;
      }
      [data-testid="collapsedControl"] {
        display: none !important;
      }
      .block-container { padding-top: 1.25rem; padding-bottom: 2rem; }
      .ns-hero {
        background: linear-gradient(135deg, rgba(0,147,132,0.16), rgba(18,24,33,0.95));
        border: 1px solid rgba(0,147,132,0.30);
        border-radius: 22px;
        padding: 1.4rem 1.5rem;
        margin-bottom: 1rem;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
      }
      .ns-subtle { color: #58606c; font-size: 0.95rem; }
      .ns-card {
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 18px;
        padding: 1rem 1.1rem;
        box-shadow: 0 8px 28px rgba(17, 24, 39, 0.06);
      }
      .ns-pill {
        display: inline-block;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .ns-kpi {
        background: linear-gradient(180deg, #ffffff, #f8fbfb);
        border: 1px solid rgba(0,147,132,0.16);
        border-radius: 18px;
        padding: 1rem 1.1rem;
      }
      .ns-alert {
        border-left: 5px solid #009384;
        background: #ffffff;
        border-radius: 14px;
        padding: 0.9rem 1rem;
        margin-bottom: 0.8rem;
        box-shadow: 0 8px 24px rgba(17, 24, 39, 0.05);
      }
    </style>
    """,
    unsafe_allow_html=True,
)


def _db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _query(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    if not DB_PATH.exists():
        return []
    with _db_connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def _safe_json(value: Any, default: Any) -> Any:
    if value in (None, "", b""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _pill(label: str, bg: str, fg: str) -> str:
    return f"<span class='ns-pill' style='background:{bg};color:{fg};'>{label}</span>"


def _decision_pill(decision: str | None) -> str:
    val = (decision or "").upper()
    if val == "BLOCK":
        return _pill("BLOCK", "#fee2e2", "#b91c1c")
    if val == "WARN":
        return _pill("WARN", "#fef3c7", "#92400e")
    return _pill(val or "SAFE", "#dcfce7", "#166534")


def _severity_pill(severity: str | None) -> str:
    val = (severity or "").upper()
    if val == "CRITICAL":
        return _pill("CRITICAL", "#fee2e2", "#991b1b")
    if val == "WARN":
        return _pill("WARN", "#fef3c7", "#92400e")
    return _pill(val or "INFO", "#dbeafe", "#1d4ed8")


def _fetch_health() -> dict[str, Any]:
    try:
        res = requests.get(f"{AI_BASE_URL}/health", timeout=5)
        res.raise_for_status()
        return res.json()
    except Exception as exc:
        return {"status": "down", "error": str(exc)}


def _recent_alerts(limit: int = 25) -> list[dict[str, Any]]:
    return _query(
        """
        SELECT id, patient_uuid, encounter_uuid, agent_name, severity, title, body,
               rule_fired, status, created_at, detailed_reasoning, decision, reasoning_trace
        FROM agent_alerts
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        """,
        (limit,),
    )


def _recent_drafts(limit: int = 20) -> list[dict[str, Any]]:
    return _query(
        """
        SELECT id, patient_uuid, encounter_uuid, doctor_uuid, raw_transcript, soap_json, status, created_at
        FROM soap_drafts
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        """,
        (limit,),
    )


def _recent_differentials(limit: int = 20) -> list[dict[str, Any]]:
    return _query(
        """
        SELECT id, patient_uuid, encounter_uuid, input_snapshot, suggestions, selected_diagnosis, status, created_at
        FROM differential_suggestions
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        """,
        (limit,),
    )


def _kpis(alerts: list[dict[str, Any]], drafts: list[dict[str, Any]], diffs: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "active_alerts": sum(1 for a in alerts if (a.get("status") or "active") == "active"),
        "critical_alerts": sum(1 for a in alerts if (a.get("severity") or "").upper() == "CRITICAL"),
        "scribe_drafts": len(drafts),
        "differentials": len(diffs),
    }


health = _fetch_health()
alerts = _recent_alerts()
drafts = _recent_drafts()
diffs = _recent_differentials()
kpis = _kpis(alerts, drafts, diffs)

known_patients = []
for row in alerts + drafts + diffs:
    patient_uuid = row.get("patient_uuid")
    if patient_uuid and patient_uuid not in known_patients:
        known_patients.append(patient_uuid)

with st.sidebar:
    st.markdown("## Neuro-Sentinel")
    st.caption("AI agent observability layer for Aegis + Bahmni")
    st.write(f"`AI service:` {AI_BASE_URL}")
    st.write(f"`Agent DB:` {DB_PATH}")
    if st.button("Refresh now", use_container_width=True):
        st.rerun()
    st.divider()
    st.markdown("### Demo drugs")
    st.code("azithromycin\nhaloperidol\namiodarone\nondansetron\nmethadone")
    st.caption("`azithromycin` is a reliable demo on the current dataset because the fallback QTc scorer flags it.")

st.markdown(
    """
    <div class="ns-hero">
      <h1 style="margin:0 0 0.35rem 0;">Neuro-Sentinel</h1>
      <div class="ns-subtle">
        Live command center for AI scribe drafts, differential suggestions, and LangGraph drug-safety alerts.
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

metric_cols = st.columns(4)
metric_cols[0].metric("Active Alerts", kpis["active_alerts"])
metric_cols[1].metric("Critical Alerts", kpis["critical_alerts"])
metric_cols[2].metric("Scribe Drafts", kpis["scribe_drafts"])
metric_cols[3].metric("Differentials", kpis["differentials"])

tab_overview, tab_drug, tab_scribe, tab_trace = st.tabs(
    ["Command Center", "Drug Safety Demo", "Scribe Drafts", "Reasoning Trace"]
)

with tab_overview:
    col_left, col_right = st.columns([1.15, 1], gap="large")
    with col_left:
        st.markdown("### Service Status")
        llm = health.get("llm", {})
        whisper = health.get("whisper", {})
        status_cols = st.columns(3)
        status_cols[0].markdown(
            f"<div class='ns-card'><strong>AI API</strong><br>{_pill(health.get('status', 'down').upper(), '#dcfce7' if health.get('status') == 'ok' else '#fee2e2', '#166534' if health.get('status') == 'ok' else '#991b1b')}</div>",
            unsafe_allow_html=True,
        )
        status_cols[1].markdown(
            f"<div class='ns-card'><strong>Gemini</strong><br>{_pill('READY' if llm.get('gemini_configured') else 'MISSING', '#dcfce7' if llm.get('gemini_configured') else '#fee2e2', '#166534' if llm.get('gemini_configured') else '#991b1b')}</div>",
            unsafe_allow_html=True,
        )
        status_cols[2].markdown(
            f"<div class='ns-card'><strong>Whisper</strong><br>{_pill((whisper.get('mode') or 'unknown').upper(), '#dbeafe', '#1d4ed8')}</div>",
            unsafe_allow_html=True,
        )
        if health.get("error"):
            st.error(health["error"])

        st.markdown("### Recent Agent Events")
        if not alerts:
            st.info("No agent alerts stored yet.")
        for alert in alerts[:8]:
            rule_data = _safe_json(alert.get("rule_fired"), {})
            st.markdown(
                f"""
                <div class="ns-alert">
                  <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                    <div>
                      <div style="font-weight:700;font-size:1rem;">{alert.get("title", "Untitled alert")}</div>
                      <div style="color:#4b5563;font-size:0.88rem;margin-top:0.25rem;">Patient: {alert.get("patient_uuid", "Unknown")}</div>
                    </div>
                    <div>{_severity_pill(alert.get("severity"))} {_decision_pill(rule_data.get("decision") or alert.get("decision"))}</div>
                  </div>
                  <div style="margin-top:0.55rem;color:#334155;font-size:0.93rem;">{(alert.get("body") or "").split("\\n\\n")[0]}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
    with col_right:
        st.markdown("### Patient Activity")
        if known_patients:
            for patient_uuid in known_patients[:10]:
                patient_alerts = sum(1 for a in alerts if a.get("patient_uuid") == patient_uuid)
                patient_drafts = sum(1 for d in drafts if d.get("patient_uuid") == patient_uuid)
                patient_diffs = sum(1 for d in diffs if d.get("patient_uuid") == patient_uuid)
                st.markdown(
                    f"""
                    <div class="ns-card" style="margin-bottom:0.7rem;">
                      <div style="font-weight:700;">{patient_uuid}</div>
                      <div class="ns-subtle">Alerts: {patient_alerts} | Scribe drafts: {patient_drafts} | Differentials: {patient_diffs}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
        else:
            st.info("No patient-linked AI activity has been stored yet.")

        st.markdown("### Differential Suggestions")
        if not diffs:
            st.info("No differential suggestions stored yet.")
        for diff in diffs[:5]:
            suggestions = _safe_json(diff.get("suggestions"), [])
            top = suggestions[0] if suggestions else {}
            st.markdown(
                f"""
                <div class="ns-card" style="margin-bottom:0.7rem;">
                  <div style="font-weight:700;">{diff.get("patient_uuid", "Unknown patient")}</div>
                  <div class="ns-subtle">Top suggestion: {top.get("diagnosis", "Not available")}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

with tab_drug:
    st.markdown("### Live LangGraph Drug Safety Demo")
    st.caption("This calls the real AI sidecar. If Gemini quota is exhausted, the local deterministic fallback still generates a clinician-facing alert.")
    default_patient = known_patients[0] if known_patients else "2eb8305a-4529-4db5-a0ec-088cc6c30fd4"
    demo_col_1, demo_col_2, demo_col_3 = st.columns([1.6, 1.2, 1])
    with demo_col_1:
        patient_uuid = st.text_input("Patient UUID", value=default_patient)
    with demo_col_2:
        drug_name = st.text_input("Drug name", value="azithromycin")
    with demo_col_3:
        encounter_uuid = st.text_input("Encounter UUID", value="")

    if st.button("Run drug safety evaluation", type="primary"):
        payload = {"patient_uuid": patient_uuid.strip(), "drug_name": drug_name.strip()}
        if encounter_uuid.strip():
            payload["encounter_uuid"] = encounter_uuid.strip()
        try:
            with st.spinner("Evaluating medication safety..."):
                res = requests.post(
                    f"{AI_BASE_URL}/api/alerts/check-drug",
                    json=payload,
                    timeout=90,
                )
                res.raise_for_status()
                data = res.json()
            st.success(f"Evaluation completed. Alerts returned: {data.get('count', 0)}")
            for alert in data.get("alerts", []):
                rule_data = _safe_json(alert.get("rule_fired"), {})
                concerns = rule_data.get("concerns") or []
                st.markdown(
                    f"""
                    <div class="ns-alert">
                      <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                        <div>
                          <div style="font-weight:700;font-size:1rem;">{alert.get("title", "Alert")}</div>
                          <div class="ns-subtle">{_decision_pill(rule_data.get("decision"))} {_severity_pill(alert.get("severity"))}</div>
                        </div>
                      </div>
                      <div style="margin-top:0.65rem;color:#334155;">{alert.get("body", "")}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
                if concerns:
                    st.json(concerns, expanded=False)
            if not data.get("alerts"):
                st.warning("No alert fired. That means the agent judged this order SAFE for the available patient context.")
            st.json(data, expanded=False)
        except Exception as exc:
            st.error(f"Drug safety check failed: {exc}")

with tab_scribe:
    st.markdown("### Recent Scribe Drafts")
    if not drafts:
        st.info("No scribe drafts stored yet.")
    for draft in drafts:
        soap = _safe_json(draft.get("soap_json"), {})
        with st.expander(
            f"{draft.get('patient_uuid', 'Unknown patient')} | {draft.get('status', 'draft')} | {draft.get('created_at', '')}",
            expanded=False,
        ):
            st.write("Encounter:", draft.get("encounter_uuid") or "None")
            st.write("Transcript preview:")
            st.code((draft.get("raw_transcript") or "")[:1500] or "No transcript stored.")
            st.write("Structured draft:")
            st.json(soap, expanded=False)

with tab_trace:
    st.markdown("### Reasoning Trace Audit")
    if not alerts:
        st.info("No alerts recorded yet.")
    for alert in alerts:
        rule_data = _safe_json(alert.get("rule_fired"), {})
        trace = _safe_json(alert.get("reasoning_trace"), [])
        with st.expander(
            f"{alert.get('title', 'Alert')} | {alert.get('patient_uuid', '')} | {(rule_data.get('decision') or alert.get('decision') or 'SAFE')}",
            expanded=False,
        ):
            st.write("Summary")
            st.write((alert.get("body") or "").split("\n\n")[0] or "No summary")
            st.write("Detailed reasoning")
            st.write(alert.get("detailed_reasoning") or alert.get("body") or "No reasoning captured")
            if trace:
                st.write("Tool trace")
                st.json(trace, expanded=False)
            else:
                st.info("No trace stored for this alert.")
