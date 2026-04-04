from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CoordinationAction(BaseModel):
    action: str
    status: str
    details: Optional[Dict[str, Any]] = None


class CareCoordRequest(BaseModel):
    care_plan_id: str
    preferred_pharmacy: Optional[str] = None


class CareCoordResponse(BaseModel):
    actions_completed: List[CoordinationAction] = Field(default_factory=list)
    confidence_score: float = 0.5

