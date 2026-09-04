import httpx
from langchain_core.tools import tool


@tool
async def rxnorm_normalize(drug_name: str) -> dict:
    """
    Normalizes any drug name to its canonical RxNorm concept.
    Returns: {rxcui, canonical_name, found: bool, ingredient_name, ...}
    Call this FIRST before any other drug tool.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://rxnav.nlm.nih.gov/REST/rxcui.json",
                params={"name": drug_name, "search": "2"},
            )
            data = r.json()
            rxcui_list = data.get("idGroup", {}).get("rxnormId", []) or []

            if not rxcui_list:
                r2 = await client.get(
                    "https://rxnav.nlm.nih.gov/REST/approximateTerm.json",
                    params={"term": drug_name, "maxEntries": 1},
                )
                candidates = r2.json().get("approximateGroup", {}).get("candidate", [])
                if candidates:
                    rxcui_list = [candidates[0]["rxcui"]]

            if not rxcui_list:
                return {
                    "found": False,
                    "rxcui": None,
                    "canonical_name": drug_name,
                    "synonyms": [],
                }

            rxcui = str(rxcui_list[0])

            r3 = await client.get(
                f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/properties.json"
            )
            props = r3.json().get("properties", {}) or {}
            canonical_name = props.get("name", drug_name)

            r4 = await client.get(
                f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json",
                params={"tty": "IN"},
            )
            related = r4.json().get("relatedGroup", {}).get("conceptGroup", [])
            ingredient_name = canonical_name
            ingredient_rxcui = rxcui
            for group in related:
                concepts = group.get("conceptProperties", [])
                if concepts:
                    ingredient_name = concepts[0].get("name", canonical_name)
                    ingredient_rxcui = concepts[0].get("rxcui", rxcui)
                    break

            return {
                "found": True,
                "rxcui": rxcui,
                "ingredient_rxcui": str(ingredient_rxcui),
                "canonical_name": canonical_name,
                "ingredient_name": ingredient_name,
                "original_input": drug_name,
            }

    except Exception as e:
        return {
            "found": False,
            "rxcui": None,
            "canonical_name": drug_name,
            "error": str(e),
        }
