from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base
from .user import generate_uuid

class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    test_name = Column(String(255), nullable=False)
    value = Column(String(100), nullable=False)
    unit = Column(String(50))
    reference_range = Column(String(100))
    flag = Column(String(50)) # e.g. 'HIGH', 'LOW', 'NORMAL', 'CRITICAL'
    
    result_date = Column(DateTime(timezone=True), index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    patient = relationship("User", back_populates="lab_results_patient")
