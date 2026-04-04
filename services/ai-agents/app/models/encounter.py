import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base
from .user import generate_uuid

class EncounterTypeEnum(str, enum.Enum):
    in_person = 'in_person'
    telemedicine = 'telemedicine'
    follow_up = 'follow_up'

class EncounterStatusEnum(str, enum.Enum):
    scheduled = 'scheduled'
    in_progress = 'in_progress'
    transcribing = 'transcribing'
    review = 'review'
    signed = 'signed'
    amended = 'amended'

class Encounter(Base):
    __tablename__ = "encounters"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    encounter_type = Column(Enum(EncounterTypeEnum), nullable=False)
    status = Column(Enum(EncounterStatusEnum), nullable=False, default=EncounterStatusEnum.scheduled, index=True)
    
    scheduled_at = Column(DateTime(timezone=True), index=True)
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    
    audio_url = Column(String(1000))
    audio_duration_seconds = Column(Integer)
    
    transcript = Column(JSON)
    soap_note = Column(JSON)
    extracted_entities = Column(JSON)
    icd10_codes = Column(JSON)
    cds_alerts = Column(JSON)
    
    is_signed = Column(Boolean, default=False)
    signed_at = Column(DateTime(timezone=True))
    
    metadata_blob = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    patient = relationship("User", foreign_keys=[patient_id], back_populates="encounters_as_patient")
    provider = relationship("User", foreign_keys=[provider_id], back_populates="encounters_as_provider")
