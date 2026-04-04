import enum
from sqlalchemy import Column, String, Date, DateTime, Enum, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base
from .user import generate_uuid

class CarePlanStatusEnum(str, enum.Enum):
    draft = 'draft'
    active = 'active'
    paused = 'paused'
    completed = 'completed'
    cancelled = 'cancelled'

class CarePlan(Base):
    __tablename__ = "care_plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    encounter_id = Column(String(36), ForeignKey("encounters.id"), nullable=False, index=True)
    provider_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    status = Column(Enum(CarePlanStatusEnum), nullable=False, default=CarePlanStatusEnum.draft, index=True)
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    discharge_summary = Column(String(5000))
    discharge_summary_embedding_id = Column(String(255))
    
    medications = Column(JSON)
    daily_schedule = Column(JSON)
    tracking_modules = Column(JSON)
    triage_thresholds = Column(JSON)
    
    follow_up_log = Column(JSON)
    adherence_score = Column(Numeric(5, 2))
    escalation_history = Column(JSON)
    
    metadata_blob = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    patient = relationship("User", foreign_keys=[patient_id], back_populates="care_plans_patient")
    provider = relationship("User", foreign_keys=[provider_id])
    encounter = relationship("Encounter", foreign_keys=[encounter_id])
