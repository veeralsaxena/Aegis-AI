from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base
from .user import generate_uuid

class Allergy(Base):
    __tablename__ = "allergies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    substance = Column(String(255), nullable=False)
    reaction = Column(String(255))
    severity = Column(String(50)) # e.g. 'mild', 'moderate', 'severe'
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    patient = relationship("User", back_populates="allergies_patient")
