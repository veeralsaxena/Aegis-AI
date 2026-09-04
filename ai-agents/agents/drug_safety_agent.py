"""
LangGraph drug safety agent: RxNorm, FDA label, GFR, interactions, QTc — LLM synthesis.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from operator import add
from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from sqlalchemy import text

from agents.tools.fda_label import fda_label_lookup
from agents.tools.gfr import calculate_gfr
from agents.tools.interactions import drug_interactions
from agents.tools.qtc import qtc_risk_score
from agents.tools.rxnorm import rxnorm_normalize
from db.database import SessionLocal
from services.gemini_support import gemini_api_key, gemini_model_id

TOOLS = [
    rxnorm_normalize,
    drug_interactions,
    fda_label_lookup,
    calculate_gfr,
    qtc_risk_score,
]

SYSTEM_PROMPT = """You are a clinical pharmacology AI assistant embedded in an EMR.
A doctor has just prescribed a drug for a patient. Perform a comprehensive drug safety evaluation using your tools.

## PROCESS (call tools in a sensible order):
1. rxnorm_normalize(drug_name) — canonical name + RxCUI.
2. fda_label_lookup(canonical or ingredient name) — label contraindications / warnings / renal text.
3. calculate_gfr(patient_uuid) — renal function.
4. drug_interactions(rxcui_string, patient_uuid) — use the RxCUI string from step 1.
5. qtc_risk_score(patient_uuid, original drug name string).

## FINAL OUTPUT (valid JSON only, no markdown):
{
  "overall_decision": "BLOCK" | "WARN" | "SAFE",
  "severity": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
  "title": "Short alert title (max 10 words)",
  "clinical_summary": "2-3 sentences for the prescriber",
  "detailed_reasoning": "Cite GFR numbers, interaction severities, FDA excerpts, QTc level",
  "specific_concerns": [
    {
      "concern_type": "renal_contraindication" | "drug_interaction" | "qtc_risk" | "hepatic" | "dose_adjustment",
      "description": "Specific concern with values",
      "evidence_source": "FDA label / RxNav / GFR / CredibleMeds"
    }
  ],
  "recommended_alternatives": "Safer alternatives if BLOCK, else empty string",
  "monitoring_required": "If WARN and they proceed",
  "safe_dose_if_applicable": "Dose adjustment text or empty"
}

## DECISION GUIDANCE:
- BLOCK + CRITICAL/HIGH: life-threatening interaction, label contraindication matching patient labs, GFR context with high-risk drug, CRITICAL QTc stack.
- WARN: moderate interactions, dose adjustment, single QTc risk, borderline renal/hepatic.
- SAFE: no significant issues after tools — still state what you verified.
"""


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add]
    patient_uuid: str
    drug_name: str
    encounter_uuid: str | None


_llm_bound = None


def get_llm():
    global _llm_bound
    if _llm_bound is not None:
        return _llm_bound
    if os.getenv("GROQ_API_KEY"):
        from langchain_openai import ChatOpenAI

        model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        _llm_bound = ChatOpenAI(
            model=model,
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
            max_tokens=2048,
            temperature=0.2,
        ).bind_tools(TOOLS)
        return _llm_bound

    gkey = gemini_api_key()
    if gkey:
        from langchain_google_genai import ChatGoogleGenerativeAI

        _llm_bound = ChatGoogleGenerativeAI(
            model=gemini_model_id(),
            google_api_key=gkey,
            max_output_tokens=2048,
            temperature=0.2,
        ).bind_tools(TOOLS)
    elif os.getenv("ANTHROPIC_API_KEY"):
        from langchain_anthropic import ChatAnthropic

        model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        _llm_bound = ChatAnthropic(
            model=model,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_tokens=2000,
        ).bind_tools(TOOLS)
    elif os.getenv("OPENAI_API_KEY"):
        from langchain_openai import ChatOpenAI

        _llm_bound = ChatOpenAI(
            model="gpt-4o",
            api_key=os.getenv("OPENAI_API_KEY"),
            max_tokens=2000,
        ).bind_tools(TOOLS)
    else:
        raise ValueError(
            "Set GOOGLE_API_KEY (Gemini), or ANTHROPIC_API_KEY, or OPENAI_API_KEY for drug safety."
        )
    return _llm_bound


async def _call_llm(state: AgentState) -> dict:
    llm = get_llm()
    response = await llm.ainvoke(list(state["messages"]))
    return {"messages": [response]}


def _route_after_llm(state: AgentState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return END


def build_drug_safety_graph():
    tool_node = ToolNode(TOOLS)
    graph = StateGraph(AgentState)
    graph.add_node("agent", _call_llm)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges(
        "agent",
        _route_after_llm,
        {"tools": "tools", END: END},
    )
    graph.add_edge("tools", "agent")
    return graph.compile()


DRUG_SAFETY_GRAPH = build_drug_safety_graph()

DECISION_PRIORITY = {"SAFE": 0, "WARN": 1, "BLOCK": 2}
SEVERITY_PRIORITY = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}


def _contains_any(text: str, needles: list[str]) -> bool:
    hay = (text or "").lower()
    return any(n in hay for n in needles)


def _preview(value: object, limit: int = 700) -> str:
    try:
        text = json.dumps(value, ensure_ascii=True)
    except Exception:
        text = str(value)
    return text[:limit]


def _normalize_failure_reason(reason: str | None) -> str:
    text = (reason or "").strip()
    lower = text.lower()
    if "429" in text or "quota" in lower:
        return "Gemini API quota exceeded"
    if "resourceexhausted" in lower:
        return "Gemini API resource limit exceeded"
    return text[:280] if text else "Unknown synthesis failure"


def _escalate(
    current_decision: str,
    current_severity: str,
    next_decision: str,
    next_severity: str,
) -> tuple[str, str]:
    decision = current_decision
    severity = current_severity
    if DECISION_PRIORITY[next_decision] > DECISION_PRIORITY[current_decision]:
        decision = next_decision
    if SEVERITY_PRIORITY[next_severity] > SEVERITY_PRIORITY[current_severity]:
        severity = next_severity
    return decision, severity


async def _run_fallback_assessment(
    patient_uuid: str,
    drug_name: str,
    failure_reason: str | None = None,
) -> tuple[dict, list[dict]]:
    reasoning_trace: list[dict] = []

    rx = await rxnorm_normalize.ainvoke({"drug_name": drug_name})
    reasoning_trace.append({"type": "tool", "tool": "rxnorm_normalize", "content": _preview(rx)})

    canonical_drug = (
        rx.get("ingredient_name")
        or rx.get("canonical_name")
        or drug_name
    )
    label = await fda_label_lookup.ainvoke({"drug_name": canonical_drug})
    reasoning_trace.append({"type": "tool", "tool": "fda_label_lookup", "content": _preview(label)})

    gfr = await calculate_gfr.ainvoke({"patient_uuid": patient_uuid})
    reasoning_trace.append({"type": "tool", "tool": "calculate_gfr", "content": _preview(gfr)})

    rxcui = rx.get("ingredient_rxcui") or rx.get("rxcui")
    if rxcui:
        interactions = await drug_interactions.ainvoke(
            {"new_drug_rxcui": str(rxcui), "patient_uuid": patient_uuid}
        )
    else:
        interactions = {
            "interactions_found": False,
            "interactions": [],
            "note": "Drug could not be normalized to an RxCUI.",
        }
    reasoning_trace.append({"type": "tool", "tool": "drug_interactions", "content": _preview(interactions)})

    qtc = await qtc_risk_score.ainvoke(
        {"patient_uuid": patient_uuid, "new_drug_name": drug_name}
    )
    reasoning_trace.append({"type": "tool", "tool": "qtc_risk_score", "content": _preview(qtc)})

    decision = "SAFE"
    severity = "LOW"
    title = f"{canonical_drug} appears safe"
    concerns: list[dict] = []
    detail_lines: list[str] = []
    monitoring: list[str] = []
    recommended_alternatives = ""
    safe_dose = ""

    if failure_reason:
        detail_lines.append(
            "LLM synthesis was unavailable, so this result used the local deterministic safety evaluator."
        )
        detail_lines.append(
            f"Fallback trigger: {_normalize_failure_reason(failure_reason)}"
        )

    detail_lines.append(
        f"Drug normalization: input '{drug_name}' resolved to '{canonical_drug}'"
        + (f" (RxCUI {rxcui})." if rxcui else ".")
    )

    contraindications_text = str(label.get("contraindications", ""))
    warnings_text = str(label.get("warnings_and_precautions", ""))
    boxed_warning = str(label.get("boxed_warning", ""))
    renal_text = str(label.get("renal_dosing", ""))
    label_text = " ".join([contraindications_text, warnings_text, boxed_warning, renal_text]).lower()

    renal_keywords = ["renal", "kidney", "creatinine", "gfr", "crcl", "dialysis"]
    hepatic_keywords = ["hepatic", "liver", "bilirubin", "transaminase", "alt", "ast"]

    high_interactions = [
        i for i in interactions.get("interactions", []) if str(i.get("severity", "")).lower() == "high"
    ]
    moderate_interactions = [
        i
        for i in interactions.get("interactions", [])
        if str(i.get("severity", "")).lower() == "moderate"
    ]
    if high_interactions:
        interaction = high_interactions[0]
        decision, severity = _escalate(decision, severity, "BLOCK", "HIGH")
        title = "Severe drug interaction"
        concerns.append(
            {
                "concern_type": "drug_interaction",
                "description": interaction.get("description")
                or f"High-severity interaction involving {', '.join(interaction.get('drugs_involved', []))}.",
                "evidence_source": "RxNav",
            }
        )
        detail_lines.append(
            f"RxNav found {len(high_interactions)} high-severity interaction(s) for the active medication list."
        )
        recommended_alternatives = (
            "Consider a non-interacting alternative or stop the interacting medication before prescribing."
        )
    elif moderate_interactions:
        interaction = moderate_interactions[0]
        decision, severity = _escalate(decision, severity, "WARN", "MODERATE")
        title = "Interaction risk detected"
        concerns.append(
            {
                "concern_type": "drug_interaction",
                "description": interaction.get("description")
                or f"Moderate interaction involving {', '.join(interaction.get('drugs_involved', []))}.",
                "evidence_source": "RxNav",
            }
        )
        detail_lines.append(
            f"RxNav found {len(moderate_interactions)} moderate interaction(s) for the active medication list."
        )
        monitoring.append("Review the interaction description and monitor for the listed adverse effects.")

    qtc_level = str(qtc.get("combined_risk_level", "LOW")).upper()
    new_drug_risk = str(qtc.get("new_drug_risk", ""))
    if qtc_level == "CRITICAL":
        decision, severity = _escalate(decision, severity, "BLOCK", "CRITICAL")
        title = "Critical QTc risk"
        concerns.append(
            {
                "concern_type": "qtc_risk",
                "description": qtc.get("recommendation")
                or "Critical QTc stacking risk detected.",
                "evidence_source": "CredibleMeds",
            }
        )
        detail_lines.append(
            f"QTc score is CRITICAL with {qtc.get('total_qtc_risk_drug_count', 0)} QTc-risk drugs."
        )
        recommended_alternatives = (
            "Consider a non-QTc-prolonging alternative if one is clinically appropriate."
        )
    elif qtc_level == "HIGH":
        decision, severity = _escalate(decision, severity, "BLOCK", "HIGH")
        title = "High QTc risk"
        concerns.append(
            {
                "concern_type": "qtc_risk",
                "description": qtc.get("recommendation")
                or "High QTc prolongation risk detected.",
                "evidence_source": "CredibleMeds",
            }
        )
        detail_lines.append(
            f"QTc score is HIGH with {qtc.get('total_qtc_risk_drug_count', 0)} QTc-risk drugs."
        )
        recommended_alternatives = (
            "Consider a non-QTc-prolonging alternative if one is clinically appropriate."
        )
    elif qtc_level == "MODERATE" and not new_drug_risk.startswith("Not in QTc risk"):
        decision, severity = _escalate(decision, severity, "WARN", "MODERATE")
        title = "QTc monitoring advised"
        concerns.append(
            {
                "concern_type": "qtc_risk",
                "description": qtc.get("recommendation")
                or f"{drug_name} carries QTc risk ({new_drug_risk}).",
                "evidence_source": "CredibleMeds",
            }
        )
        detail_lines.append(f"QTc score is MODERATE. New drug risk category: {new_drug_risk}.")
        monitoring.append("Obtain a baseline ECG if clinically indicated and correct K/Mg abnormalities.")

    if gfr.get("gfr_calculated"):
        gfr_value = gfr.get("gfr_value")
        creatinine = gfr.get("creatinine")
        stage = gfr.get("gfr_stage")
        detail_lines.append(
            f"Renal function: Cockcroft-Gault estimate {gfr_value} mL/min (stage {stage}), creatinine {creatinine}."
        )
        if gfr_value is not None and float(gfr_value) < 15:
            decision, severity = _escalate(decision, severity, "BLOCK", "CRITICAL")
            title = "Renal contraindication risk"
            concerns.append(
                {
                    "concern_type": "renal_contraindication",
                    "description": f"GFR is {gfr_value} mL/min, in kidney failure range.",
                    "evidence_source": "GFR calculation",
                }
            )
            recommended_alternatives = (
                recommended_alternatives
                or "Consider a specialist-reviewed alternative or renal-adjusted regimen."
            )
        elif gfr_value is not None and float(gfr_value) < 30:
            next_decision = "BLOCK" if _contains_any(label_text, renal_keywords) else "WARN"
            next_severity = "HIGH"
            decision, severity = _escalate(decision, severity, next_decision, next_severity)
            title = "Renal dosing concern"
            concerns.append(
                {
                    "concern_type": "dose_adjustment",
                    "description": (
                        f"GFR is {gfr_value} mL/min. Severe renal impairment requires label review before prescribing."
                    ),
                    "evidence_source": "GFR calculation",
                }
            )
            safe_dose = "Use a renal-adjusted dose only if the product label or pharmacist confirms it is appropriate."
            monitoring.append("Review creatinine and repeat renal function during therapy.")
        elif gfr_value is not None and float(gfr_value) < 45 and _contains_any(label_text, renal_keywords):
            decision, severity = _escalate(decision, severity, "WARN", "MODERATE")
            title = "Dose adjustment may be needed"
            concerns.append(
                {
                    "concern_type": "dose_adjustment",
                    "description": f"GFR is {gfr_value} mL/min and the label includes renal dosing language.",
                    "evidence_source": "FDA label / GFR calculation",
                }
            )
            safe_dose = "Use renal dose adjustment per the product label or local pharmacy protocol."
            monitoring.append("Monitor renal function and clinical response.")
    else:
        detail_lines.append(
            f"Renal assessment incomplete: {gfr.get('error') or 'No recent creatinine available.'}"
        )

    if gfr.get("hepatic_concern"):
        decision, severity = _escalate(decision, severity, "WARN", "MODERATE")
        title = "Hepatic caution"
        concerns.append(
            {
                "concern_type": "hepatic",
                "description": gfr.get("hepatic_note")
                or "Liver test abnormalities may affect drug clearance.",
                "evidence_source": "GFR calculation",
            }
        )
        detail_lines.append("Liver tests suggest hepatic impairment.")
        monitoring.append("Review liver enzymes and bilirubin before or during therapy.")

    if _contains_any(label_text, hepatic_keywords):
        detail_lines.append("FDA label contains hepatic safety language.")
    if contraindications_text and contraindications_text != "Not specified in label.":
        detail_lines.append(f"FDA contraindications excerpt: {contraindications_text[:240]}")
    if warnings_text and warnings_text != "Not specified in label.":
        detail_lines.append(f"FDA warnings excerpt: {warnings_text[:240]}")
    if boxed_warning and boxed_warning != "Not specified in label.":
        detail_lines.append(f"FDA boxed warning excerpt: {boxed_warning[:240]}")

    if decision == "SAFE":
        detail_lines.append(
            "No high-severity interaction, critical QTc stack, or severe renal contraindication was identified."
        )

    clinical_summary = (
        {
            "BLOCK": (
                f"{canonical_drug} should be blocked based on the current safety check. "
                "The evaluation found a clinically significant risk that warrants changing the plan."
            ),
            "WARN": (
                f"{canonical_drug} can proceed only with caution. "
                "The evaluation found a monitoring or dose-adjustment issue that the prescriber should review."
            ),
            "SAFE": (
                f"No major drug-safety issue was identified for {canonical_drug}. "
                "The agent checked interactions, renal function, FDA label text, and QTc risk."
            ),
        }[decision]
    )

    assessment = {
        "overall_decision": decision,
        "severity": severity,
        "title": title[:120],
        "clinical_summary": clinical_summary,
        "detailed_reasoning": " ".join(detail_lines)[:8000],
        "specific_concerns": concerns,
        "recommended_alternatives": recommended_alternatives[:4000],
        "monitoring_required": " ".join(dict.fromkeys(monitoring))[:4000],
        "safe_dose_if_applicable": safe_dose[:4000],
    }
    return assessment, reasoning_trace


def _map_severity_for_db(sev: str, decision: str) -> str:
    s = (sev or "").upper()
    if s in ("CRITICAL", "HIGH"):
        return "CRITICAL"
    if s in ("MODERATE", "MEDIUM", "WARN") or decision == "WARN":
        return "WARN"
    return "INFO"


async def run_drug_safety_agent(
    patient_uuid: str,
    drug_name: str,
    encounter_uuid: str | None = None,
) -> list[dict]:
    initial_state: AgentState = {
        "messages": [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(
                content=(
                    f"Patient UUID: {patient_uuid}\n"
                    f"Drug being prescribed: {drug_name}\n\n"
                    "Perform the complete drug safety evaluation."
                )
            ),
        ],
        "patient_uuid": patient_uuid,
        "drug_name": drug_name,
        "encounter_uuid": encounter_uuid,
    }

    final_state = None
    fallback_reason: str | None = None
    try:
        final_state = await DRUG_SAFETY_GRAPH.ainvoke(
            initial_state,
            config={"recursion_limit": 40},
        )
    except Exception as e:
        print(f"[DrugSafetyAgent] ERROR: {e}")
        fallback_reason = str(e)

    if final_state is not None:
        final_message = final_state["messages"][-1]
        raw_content = (
            final_message.content
            if hasattr(final_message, "content")
            else str(final_message)
        )
        if isinstance(raw_content, list):
            raw_content = "".join(
                getattr(b, "text", str(b)) for b in raw_content
            )

        try:
            raw = raw_content.strip()
            if "```" in raw:
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            assessment = json.loads(raw.strip())
        except json.JSONDecodeError:
            assessment = {
                "overall_decision": "WARN",
                "severity": "MODERATE",
                "title": "Drug safety check incomplete",
                "clinical_summary": f"Automated safety check for {drug_name} needs manual review.",
                "detailed_reasoning": str(raw_content)[:500],
                "specific_concerns": [],
                "recommended_alternatives": "",
                "monitoring_required": "Manual pharmacist review recommended",
                "safe_dose_if_applicable": "",
            }

        reasoning_trace = []
        for msg in final_state["messages"]:
            name = type(msg).__name__
            if name in ("ToolMessage", "AIMessage") and hasattr(msg, "content"):
                reasoning_trace.append(
                    {"type": name, "content": str(msg.content)[:400]}
                )
    else:
        try:
            assessment, reasoning_trace = await _run_fallback_assessment(
                patient_uuid=patient_uuid,
                drug_name=drug_name,
                failure_reason=fallback_reason,
            )
        except Exception as fallback_error:
            print(f"[DrugSafetyAgent] FALLBACK ERROR: {fallback_error}")
            return []

    decision = assessment.get("overall_decision", "SAFE")
    if decision not in ("BLOCK", "WARN"):
        return []

    alert_id = str(uuid.uuid4())
    db_severity = _map_severity_for_db(
        str(assessment.get("severity", "MODERATE")), decision
    )
    concerns_list = assessment.get("specific_concerns", [])
    rule_payload = json.dumps(
        {
            "decision": decision,
            "concerns": concerns_list,
            "alternatives": assessment.get("recommended_alternatives", ""),
            "monitoring": assessment.get("monitoring_required", ""),
            "safe_dose": assessment.get("safe_dose_if_applicable", ""),
        }
    )
    summary = assessment.get("clinical_summary", "")
    detail = assessment.get("detailed_reasoning", "")
    body = f"{summary}\n\n{detail}".strip()

    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                INSERT INTO agent_alerts (
                    id, patient_uuid, encounter_uuid, agent_name, severity,
                    title, body, rule_fired, status, created_at,
                    detailed_reasoning, specific_concerns, recommended_alternatives,
                    monitoring_required, safe_dose, decision, reasoning_trace
                ) VALUES (
                    :id, :patient_uuid, :encounter_uuid, :agent_name, :severity,
                    :title, :body, :rule_fired, 'active', :created_at,
                    :detailed_reasoning, :specific_concerns, :recommended_alternatives,
                    :monitoring_required, :safe_dose, :decision, :reasoning_trace
                )
                """
            ),
            {
                "id": alert_id,
                "patient_uuid": patient_uuid,
                "encounter_uuid": encounter_uuid,
                "agent_name": "drug_safety_langgraph",
                "severity": db_severity,
                "title": assessment.get("title", f"Drug safety: {drug_name}")[:500],
                "body": body[:8000],
                "rule_fired": rule_payload[:8000],
                "created_at": now,
                "detailed_reasoning": detail[:8000],
                "specific_concerns": json.dumps(concerns_list)[:8000],
                "recommended_alternatives": (assessment.get("recommended_alternatives") or "")[
                    :4000
                ],
                "monitoring_required": (assessment.get("monitoring_required") or "")[:4000],
                "safe_dose": (assessment.get("safe_dose_if_applicable") or "")[:4000],
                "decision": decision,
                "reasoning_trace": json.dumps(reasoning_trace)[:8000],
            },
        )
        db.commit()
    finally:
        db.close()

    return [
        {
            "id": alert_id,
            "patient_uuid": patient_uuid,
            "encounter_uuid": encounter_uuid,
            "agent_name": "drug_safety_langgraph",
            "severity": db_severity,
            "title": assessment.get("title", ""),
            "body": body,
            "rule_fired": rule_payload,
            "status": "active",
            "created_at": now.isoformat(),
        }
    ]
