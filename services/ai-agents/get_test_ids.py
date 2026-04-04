from app.database import SessionLocal
from app.models import User, Encounter
import json

db = SessionLocal()
p = db.query(User).filter_by(role='PATIENT').first()
e = db.query(Encounter).filter_by(patient_id=p.id).first()

if p and e:
    data = {"patient_id": p.id, "encounter_id": e.id}
    with open("test_payload.json", "w") as f:
        json.dump(data, f, indent=2)
else:
    with open("test_payload.json", "w") as f:
        f.write("None")
db.close()
