import requests
import random
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8080/openmrs/ws/rest/v1"
AUTH = ('superman', 'Admin123')
HEADERS = {'Content-Type': 'application/json'}

# Using the identifier generator details from the frontend
IDENTIFIER_SOURCE_UUID = "c5cf4b68-6529-43fc-a644-c775ae73745e"
IDENTIFIER_TYPE = "b9a9e100-f496-11ed-b02c-0242ac150003"
LOCATION_UUID = "833d0c66-e29a-4d31-ac13-ca9050d1bfa9" # Registration Desk usually

PATIENTS = [
    ("Aarav", "Patel", "M"), ("Prisha", "Sharma", "F"), ("Vihaan", "Iyer", "M"),
    ("Diya", "Menon", "F"), ("Arjun", "Rao", "M"), ("Sanya", "Verma", "F")
]

DRUGS = ["Paracetamol", "Amoxicillin", "Ibuprofen", "Metformin", "Amlodipine"]
DIAGNOSES = ["Hypertension", "Type 2 Diabetes", "Asthma", "Common Cold"]

def create_patient(first, last, gender):
    birthdate = (datetime.now() - timedelta(days=random.randint(10000, 20000))).strftime("%Y-%m-%d")
    payload = {
        "patient": {
            "person": {
                "names": [{"givenName": first, "familyName": last, "preferred": True}],
                "gender": gender,
                "birthdate": birthdate,
                "birthdateEstimated": False,
                "addresses": [{"cityVillage": "Cityville"}]
            },
            "identifiers": [
                {
                    "identifierSourceUuid": IDENTIFIER_SOURCE_UUID,
                    "identifierPrefix": "GAN",
                    "identifierType": IDENTIFIER_TYPE,
                    "preferred": True,
                    "voided": False
                }
            ]
        },
        "relationships": []
    }
    print(f"Creating patient {first} {last}...")
    res = requests.post(f"{BASE_URL}/bahmnicore/patientprofile", json=payload, auth=AUTH, headers=HEADERS)
    if res.status_code in [200, 201]:
        data = res.json()
        patient = data.get("patient", data)
        return patient['uuid']
    else:
        print(f"Failed to create {first}: {res.text}")
        return None

def start_visit(patient_uuid):
    payload = {
        "patient": patient_uuid,
        "visitType": "13a5ea15-82bc-45ee-b07d-763c346e1cf5", # OPD
        "location": LOCATION_UUID,
        "startDatetime": datetime.now().isoformat()
    }
    res = requests.post(f"{BASE_URL}/visit", json=payload, auth=AUTH, headers=HEADERS)
    if res.status_code in [200, 201]:
        return res.json()['uuid']
    return None

def main():
    print("Seeding Bahmni EHR with Patients and Visits via API...")
    for first, last, gender in PATIENTS:
        patient_uuid = create_patient(first, last, gender)
        if patient_uuid:
            visit_uuid = start_visit(patient_uuid)
            print(f"Successfully seeded {first} {last} (UUID: {patient_uuid}), Visit: {visit_uuid}")

    print("Seeding complete.")

if __name__ == "__main__":
    main()
