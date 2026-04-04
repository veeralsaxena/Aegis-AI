import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from .base import Base

def generate_uuid():
    return str(uuid.uuid4())

class RoleEnum(str, enum.Enum):
    SUPER_ADMIN = 'SUPER_ADMIN'
    ADMIN = 'ADMIN'
    PROVIDER = 'PROVIDER'
    NURSE = 'NURSE'
    PATIENT = 'PATIENT'
    CAREGIVER = 'CAREGIVER'

class GenderEnum(str, enum.Enum):
    male = 'male'
    female = 'female'
    other = 'other'
    undisclosed = 'undisclosed'

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    role = Column(Enum(RoleEnum), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(15), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(DateTime)
    gender = Column(Enum(GenderEnum))
    abha_id = Column(String(20), unique=True, index=True, nullable=True)
    preferred_language = Column(String(5), default='en')
    specialization = Column(String(100), nullable=True)
    license_number = Column(String(50), nullable=True)
    linked_provider_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    encounters_as_patient = relationship("Encounter", foreign_keys="[Encounter.patient_id]", back_populates="patient")
    encounters_as_provider = relationship("Encounter", foreign_keys="[Encounter.provider_id]", back_populates="provider")
    medications_patient = relationship("Medication", back_populates="patient")
    lab_results_patient = relationship("LabResult", back_populates="patient")
    allergies_patient = relationship("Allergy", back_populates="patient")
    care_plans_patient = relationship("CarePlan", foreign_keys="[CarePlan.patient_id]", back_populates="patient")
