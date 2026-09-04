from langchain_core.tools import tool

from agents.tools.crediblemeds import load_crediblemeds_db
from services.bahmni_client import get_active_drug_orders, get_latest_obs

QTC_DB = load_crediblemeds_db()


def get_qtc_risk(drug_name: str) -> str | None:
    name_lower = drug_name.lower().strip()
    if name_lower in QTC_DB:
        return QTC_DB[name_lower]
    for db_name, risk in QTC_DB.items():
        if db_name in name_lower or name_lower.startswith(db_name):
            return risk
    return None


@tool
async def qtc_risk_score(patient_uuid: str, new_drug_name: str) -> dict:
    """
    QTc prolongation risk across active meds plus new drug; factors electrolytes.
    """
    result: dict = {
        "qtc_risk_assessed": True,
        "new_drug_risk": None,
        "existing_at_risk_drugs": [],
        "total_qtc_risk_drug_count": 0,
        "combined_risk_level": "LOW",
        "electrolytes": {},
        "recommendation": "",
    }

    new_drug_risk = get_qtc_risk(new_drug_name)
    result["new_drug_risk"] = new_drug_risk or "Not in QTc risk database (likely safe)"

    try:
        active_orders = await get_active_drug_orders(patient_uuid)
        at_risk_existing = []
        for order in active_orders:
            drug_name = (
                order.get("drug", {}).get("display")
                or order.get("concept", {}).get("display", "")
            )
            if not drug_name:
                continue
            risk = get_qtc_risk(drug_name)
            if risk:
                at_risk_existing.append({"drug": drug_name, "risk_category": risk})

        result["existing_at_risk_drugs"] = at_risk_existing

        known_risk_count = sum(
            1 for d in at_risk_existing if d["risk_category"] == "Known Risk"
        )
        if new_drug_risk == "Known Risk":
            known_risk_count += 1
        conditional_risk_count = sum(
            1 for d in at_risk_existing if d["risk_category"] == "Conditional Risk"
        )
        if new_drug_risk == "Conditional Risk":
            conditional_risk_count += 1

        total = known_risk_count + (conditional_risk_count * 0.5)
        result["total_qtc_risk_drug_count"] = known_risk_count + conditional_risk_count

        potassium_obs = await get_latest_obs(patient_uuid, "Potassium", limit=1)
        magnesium_obs = await get_latest_obs(patient_uuid, "Magnesium", limit=1)

        electrolyte_risk = False
        if potassium_obs and potassium_obs[0].get("value") is not None:
            k = float(potassium_obs[0]["value"])
            result["electrolytes"]["potassium"] = k
            if k < 3.5:
                electrolyte_risk = True
                result["electrolytes"]["potassium_note"] = (
                    f"HYPOKALEMIA ({k} mEq/L) — amplifies QTc risk"
                )

        if magnesium_obs and magnesium_obs[0].get("value") is not None:
            mg = float(magnesium_obs[0]["value"])
            result["electrolytes"]["magnesium"] = mg
            if mg < 1.8:
                electrolyte_risk = True
                result["electrolytes"]["magnesium_note"] = (
                    f"HYPOMAGNESEMIA ({mg} mEq/L) — amplifies QTc risk"
                )

        if electrolyte_risk:
            total *= 2

        if total >= 3:
            risk_level = "CRITICAL"
            rec = (
                "Multiple QTc-prolonging drugs and/or electrolyte risk — "
                "significant Torsades risk; ECG/QTc review strongly recommended."
            )
        elif total >= 2:
            risk_level = "HIGH"
            rec = (
                "Several QTc-risk drugs — baseline ECG and monitoring recommended; "
                "avoid additional QTc prolongers."
            )
        elif total >= 1 and new_drug_risk:
            risk_level = "MODERATE"
            rec = (
                f"New drug ({new_drug_name}) has QTc signal ({new_drug_risk}). "
                "Consider ECG if clinically indicated."
            )
        else:
            risk_level = "LOW"
            rec = "No major QTc stacking identified."

        if electrolyte_risk and risk_level != "CRITICAL":
            rec += " Electrolyte abnormalities — correct before QTc-active drugs."

        result["combined_risk_level"] = risk_level
        result["recommendation"] = rec

    except Exception as e:
        result["error"] = str(e)

    return result
