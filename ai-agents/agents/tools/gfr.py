from langchain_core.tools import tool

from services.bahmni_client import get_latest_obs, get_patient


@tool
async def calculate_gfr(patient_uuid: str) -> dict:
    """
    Cockcroft-Gault creatinine clearance estimate + optional liver labs.
    """
    result: dict = {
        "gfr_calculated": False,
        "gfr_value": None,
        "gfr_stage": None,
        "gfr_interpretation": None,
        "creatinine": None,
        "age": None,
        "weight": None,
        "sex": None,
        "liver_function": {},
    }

    try:
        patient_data = await get_patient(patient_uuid)
        person = patient_data.get("person", {}) or {}
        age = person.get("age")
        sex = person.get("gender", "M")

        result["age"] = age
        result["sex"] = sex

        if age is None:
            result["error"] = "Age not available in patient record"
            return result

        creatinine_obs = await get_latest_obs(patient_uuid, "Creatinine", limit=1)
        if not creatinine_obs or creatinine_obs[0].get("value") is None:
            result["error"] = "No creatinine result found in Bahmni"
            return result

        creatinine = float(creatinine_obs[0]["value"])
        result["creatinine"] = creatinine
        result["creatinine_date"] = creatinine_obs[0].get("obsDatetime", "")

        weight_obs = await get_latest_obs(patient_uuid, "Weight (kg)", limit=1)
        weight = float(weight_obs[0]["value"]) if weight_obs else 70.0
        result["weight"] = weight
        result["weight_assumed"] = not bool(weight_obs)

        if creatinine <= 0:
            result["error"] = "Invalid creatinine value (zero or negative)"
            return result

        gfr = ((140 - float(age)) * weight) / (72 * creatinine)
        if str(sex).upper() in ("F", "FEMALE"):
            gfr *= 0.85

        gfr = round(gfr, 1)
        result["gfr_calculated"] = True
        result["gfr_value"] = gfr
        result["formula"] = "Cockcroft-Gault"

        if gfr >= 90:
            stage, interpretation = (
                "G1",
                "Normal renal function. No dose adjustment needed for most drugs.",
            )
        elif gfr >= 60:
            stage, interpretation = (
                "G2",
                "Mildly reduced. Monitor but most drugs safe at standard doses.",
            )
        elif gfr >= 45:
            stage, interpretation = (
                "G3a",
                "Mild-to-moderate impairment. Some renally cleared drugs need dose reduction.",
            )
        elif gfr >= 30:
            stage, interpretation = (
                "G3b",
                "Moderate-to-severe impairment. Most renally cleared drugs need dose reduction or avoidance.",
            )
        elif gfr >= 15:
            stage, interpretation = (
                "G4",
                "Severe impairment. Very few drugs safe at normal doses.",
            )
        else:
            stage, interpretation = (
                "G5",
                "Kidney failure / dialysis range.",
            )

        result["gfr_stage"] = stage
        result["gfr_interpretation"] = interpretation

        liver_tests = {
            "ALT": "ALT",
            "AST": "AST",
            "Bilirubin (total)": "Bilirubin",
            "Albumin": "Albumin",
            "INR": "INR",
        }
        for concept, label in liver_tests.items():
            obs = await get_latest_obs(patient_uuid, concept, limit=1)
            if obs and obs[0].get("value") is not None:
                result["liver_function"][label] = float(obs[0]["value"])

        alt = result["liver_function"].get("ALT", 0) or 0
        bilirubin = result["liver_function"].get("Bilirubin", 0) or 0
        if alt > 120 or bilirubin > 2.0:
            result["hepatic_concern"] = True
            result["hepatic_note"] = (
                "LFT abnormalities suggest hepatic impairment — review hepatic metabolism."
            )
        else:
            result["hepatic_concern"] = False

    except Exception as e:
        result["error"] = str(e)

    return result
