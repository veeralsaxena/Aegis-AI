import re

import httpx
from langchain_core.tools import tool


@tool
async def fda_label_lookup(drug_name: str) -> dict:
    """
    Fetches FDA drug label excerpts: contraindications, warnings, renal/hepatic sections.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            q = drug_name.replace('"', " ")
            r = await client.get(
                "https://api.fda.gov/drug/label.json",
                params={
                    "search": f'openfda.generic_name:"{q}"+openfda.brand_name:"{q}"',
                    "limit": 1,
                },
            )

            if r.status_code != 200:
                r = await client.get(
                    "https://api.fda.gov/drug/label.json",
                    params={"search": q, "limit": 1},
                )

            if r.status_code != 200:
                return {"found": False, "drug_name": drug_name, "error": "FDA label not found"}

            results = r.json().get("results", [])
            if not results:
                return {"found": False, "drug_name": drug_name}

            label = results[0]

            def extract_section(label_dict: dict, *keys: str) -> str:
                for key in keys:
                    val = label_dict.get(key)
                    if val:
                        text = " ".join(val) if isinstance(val, list) else str(val)
                        text = re.sub(r"<[^>]+>", " ", text)
                        text = re.sub(r"\s+", " ", text).strip()
                        return text[:1500]
                return "Not specified in label."

            openfda = label.get("openfda", {}) or {}
            gnames = openfda.get("generic_name", []) or [drug_name]

            return {
                "found": True,
                "drug_name": drug_name,
                "brand_names": (openfda.get("brand_name", []) or [])[:3],
                "generic_name": gnames[0] if gnames else drug_name,
                "contraindications": extract_section(label, "contraindications"),
                "warnings_and_precautions": extract_section(
                    label, "warnings_and_precautions", "warnings", "boxed_warning"
                ),
                "renal_dosing": extract_section(
                    label, "dosage_and_administration", "use_in_specific_populations"
                ),
                "drug_interactions_section": extract_section(label, "drug_interactions"),
                "boxed_warning": extract_section(label, "boxed_warning"),
            }

    except Exception as e:
        return {"found": False, "drug_name": drug_name, "error": str(e)}
