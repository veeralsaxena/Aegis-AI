import csv
from pathlib import Path

BUILTIN_QTC_DRUGS: dict[str, str] = {
    "amiodarone": "Known Risk",
    "sotalol": "Known Risk",
    "dofetilide": "Known Risk",
    "ibutilide": "Known Risk",
    "quinidine": "Known Risk",
    "procainamide": "Known Risk",
    "disopyramide": "Known Risk",
    "haloperidol": "Known Risk",
    "droperidol": "Known Risk",
    "thioridazine": "Known Risk",
    "pimozide": "Known Risk",
    "chlorpromazine": "Known Risk",
    "ziprasidone": "Known Risk",
    "quetiapine": "Known Risk",
    "methadone": "Known Risk",
    "azithromycin": "Known Risk",
    "clarithromycin": "Known Risk",
    "erythromycin": "Known Risk",
    "moxifloxacin": "Known Risk",
    "levofloxacin": "Known Risk",
    "ciprofloxacin": "Conditional Risk",
    "fluconazole": "Known Risk",
    "voriconazole": "Known Risk",
    "itraconazole": "Conditional Risk",
    "ondansetron": "Known Risk",
    "domperidone": "Known Risk",
    "metoclopramide": "Conditional Risk",
    "hydroxychloroquine": "Known Risk",
    "chloroquine": "Known Risk",
    "citalopram": "Known Risk",
    "escitalopram": "Known Risk",
    "sertraline": "Conditional Risk",
    "fluoxetine": "Conditional Risk",
    "paroxetine": "Conditional Risk",
    "amitriptyline": "Known Risk",
    "imipramine": "Known Risk",
    "clomipramine": "Known Risk",
    "lithium": "Conditional Risk",
    "risperidone": "Conditional Risk",
    "olanzapine": "Conditional Risk",
    "clozapine": "Conditional Risk",
    "aripiprazole": "Conditional Risk",
    "pentamidine": "Known Risk",
    "quinine": "Known Risk",
    "ranolazine": "Known Risk",
    "cisapride": "Known Risk",
    "saquinavir": "Known Risk",
}


def load_crediblemeds_db() -> dict[str, str]:
    csv_path = (
        Path(__file__).resolve().parent.parent.parent / "data" / "crediblemeds.csv"
    )

    if csv_path.exists():
        db: dict[str, str] = {}
        try:
            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row.get("Drug Name", row.get("drug_name", "")).strip().lower()
                    risk = row.get("Risk Category", row.get("risk_category", "")).strip()
                    if name and risk:
                        db[name] = risk
            if db:
                return db
        except Exception:
            pass

    return BUILTIN_QTC_DRUGS
