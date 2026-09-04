import httpx
from langchain_core.tools import tool

from services.bahmni_client import get_active_drug_orders


@tool
async def drug_interactions(new_drug_rxcui: str, patient_uuid: str) -> dict:
    """
    Checks the new drug (by RxCUI) against active medications using NLM RxNav.
    """
    try:
        active_orders = await get_active_drug_orders(patient_uuid)
        active_rxcuis: list[str] = []
        active_names: list[str] = []

        async with httpx.AsyncClient(timeout=20.0) as client:
            for order in active_orders:
                drug_name = (
                    order.get("drug", {}).get("display")
                    or order.get("concept", {}).get("display", "")
                )
                if not drug_name:
                    continue
                r = await client.get(
                    "https://rxnav.nlm.nih.gov/REST/rxcui.json",
                    params={"name": drug_name, "search": "2"},
                )
                ids = r.json().get("idGroup", {}).get("rxnormId", []) or []
                if ids:
                    active_rxcuis.append(str(ids[0]))
                    active_names.append(drug_name)

            if not active_rxcuis:
                return {
                    "interactions_found": False,
                    "active_medication_count": 0,
                    "interactions": [],
                    "note": "No active medications found in Bahmni for this patient.",
                }

            all_rxcuis = [str(new_drug_rxcui)] + active_rxcuis
            rxcui_string = "+".join(all_rxcuis)

            r_interact = await client.get(
                "https://rxnav.nlm.nih.gov/REST/interaction/list.json",
                params={"rxcuis": rxcui_string},
            )
            interact_data = r_interact.json()

            interactions = []
            for group in interact_data.get("fullInteractionTypeGroup", []):
                source = group.get("sourceName", "")
                for interaction_type in group.get("fullInteractionType", []):
                    comment = interaction_type.get("comment", "")
                    for pair in interaction_type.get("interactionPair", []):
                        severity = pair.get("severity", "unknown")
                        description = pair.get("description", "")
                        drugs_involved = [
                            c.get("minConcept", {}).get("name", "")
                            for c in pair.get("interactionConcept", [])
                        ]
                        interactions.append(
                            {
                                "severity": severity,
                                "drugs_involved": drugs_involved,
                                "description": description,
                                "comment": comment,
                                "source": source,
                            }
                        )

            severity_order = {"high": 0, "moderate": 1, "low": 2, "unknown": 3}
            interactions.sort(
                key=lambda x: severity_order.get(x["severity"].lower(), 3)
            )

            return {
                "interactions_found": len(interactions) > 0,
                "interaction_count": len(interactions),
                "active_medications_checked": active_names,
                "interactions": interactions[:10],
            }

    except Exception as e:
        return {"interactions_found": False, "interactions": [], "error": str(e)}
