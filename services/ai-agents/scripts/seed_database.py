import sys
import os
import random
from datetime import datetime, timedelta

# Add parent dir to path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, SessionLocal
from app.models.base import Base
from app.models import User, Encounter, Medication, LabResult, Allergy, RoleEnum, GenderEnum, EncounterTypeEnum, EncounterStatusEnum

# Dummy Data for seeding
PATIENT_NAMES = [
    ("Aarav", "Patel"), ("Vivaan", "Sharma"), ("Aditya", "Iyer"), ("Vihaan", "Desai"), 
    ("Arjun", "Rao"), ("Sai", "Reddy"), ("Aanya", "Nair"), ("Diya", "Menon"), 
    ("Sanya", "Verma"), ("Ananya", "Singh"), ("Mira", "Joshi"), ("Kavya", "Kumar")
]

CONDITIONS = [
    ("E11.9", "Type 2 diabetes mellitus without complications"),
    ("I10", "Essential (primary) hypertension"),
    ("J45.909", "Unspecified asthma, uncomplicated"),
    ("E78.5", "Hyperlipidemia, unspecified"),
    ("K21.9", "Gastro-esophageal reflux disease without esophagitis"),
    ("M54.5", "Low back pain")
]

DRUGS = [
    ("Metformin", "500mg", "BID", "PO"),
    ("Amlodipine", "5mg", "Daily", "PO"),
    ("Atorvastatin", "20mg", "Daily", "PO"),
    ("Albuterol", "90mcg", "PRN", "Inhalation"),
    ("Omeprazole", "40mg", "Daily", "PO"),
    ("Lisinopril", "10mg", "Daily", "PO")
]

LABS = [
    ("HbA1c", lambda: f"{random.uniform(5.5, 9.5):.1f}", "%", "4.0-5.6", lambda v: "HIGH" if float(v) > 5.6 else "NORMAL"),
    ("Fasting Glucose", lambda: str(random.randint(80, 180)), "mg/dL", "70-99", lambda v: "HIGH" if int(v) > 99 else "NORMAL"),
    ("Total Cholesterol", lambda: str(random.randint(150, 260)), "mg/dL", "<200", lambda v: "HIGH" if int(v) >= 200 else "NORMAL"),
    ("TSH", lambda: f"{random.uniform(0.5, 6.0):.2f}", "mIU/L", "0.4-4.0", lambda v: "HIGH" if float(v) > 4.0 else "NORMAL"),
]

ALLERGENS = [
    ("Penicillin", "Rash", "mild"),
    ("Peanuts", "Anaphylaxis", "severe"),
    ("Sulfa Drugs", "Hives", "moderate"),
    ("Contrast Dye", "Nausea", "mild")
]

def generate_abha():
    return f"{random.randint(10, 99)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"

def seed_db():
    print("Recreating all tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        print("Creating Providers...")
        provider1 = User(
            role=RoleEnum.PROVIDER, email="dr.sharma@omnicare.ai", phone="+919876543210",
            full_name="Dr. Anil Sharma", gender=GenderEnum.male, specialization="Internal Medicine",
            license_number="MCI-12345"
        )
        provider2 = User(
            role=RoleEnum.PROVIDER, email="dr.menon@omnicare.ai", phone="+919876543211",
            full_name="Dr. Priya Menon", gender=GenderEnum.female, specialization="Cardiology",
            license_number="MCI-67890"
        )
        db.add_all([provider1, provider2])
        db.commit()
        
        providers = [provider1, provider2]
        
        print("Creating 12 Patients with Clinical Histories...")
        for first, last in PATIENT_NAMES:
            gender = GenderEnum.male if random.choice([True, False]) else GenderEnum.female
            patient = User(
                role=RoleEnum.PATIENT, email=f"{first.lower()}.{last.lower()}@example.com", 
                phone=f"+9198{random.randint(10000000, 99999999)}",
                full_name=f"{first} {last}", gender=gender, abha_id=generate_abha(),
                date_of_birth=datetime.now() - timedelta(days=random.randint(10000, 25000))
            )
            db.add(patient)
            db.commit()
            
            # Encounters
            num_encounters = random.randint(1, 4)
            for _ in range(num_encounters):
                provider = random.choice(providers)
                enc = Encounter(
                    patient_id=patient.id, provider_id=provider.id,
                    encounter_type=random.choice(list(EncounterTypeEnum)),
                    status=EncounterStatusEnum.signed,
                    scheduled_at=datetime.now() - timedelta(days=random.randint(5, 365)),
                    soap_note={
                        "subjective": f"Patient {first} presenting for routine checkup.",
                        "objective": "Vitals stable.",
                        "assessment": "Ongoing management of chronic conditions.",
                        "plan": "Continue current medications."
                    }
                )
                db.add(enc)
                
            # Medications
            for _ in range(random.randint(0, 3)):
                med = random.choice(DRUGS)
                db.add(Medication(
                    patient_id=patient.id, name=med[0], dosage=med[1], frequency=med[2],
                    route=med[3], prescribed_date=datetime.now() - timedelta(days=random.randint(10, 100))
                ))
            
            # Labs
            for _ in range(random.randint(1, 4)):
                lab = random.choice(LABS)
                val = lab[1]()
                db.add(LabResult(
                    patient_id=patient.id, test_name=lab[0], value=val, unit=lab[2],
                    reference_range=lab[3], flag=lab[4](val), result_date=datetime.now() - timedelta(days=random.randint(1, 90))
                ))
                
            # Allergies
            if random.random() > 0.7:
                alg = random.choice(ALLERGENS)
                db.add(Allergy(
                    patient_id=patient.id, substance=alg[0], reaction=alg[1], severity=alg[2]
                ))
                
        db.commit()
        print("Database seeding completed successfully.")
        
    except Exception as e:
        print(f"Error seeding db: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
