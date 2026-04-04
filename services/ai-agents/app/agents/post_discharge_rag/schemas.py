from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RagChatRequest(BaseModel):
    care_plan_id: str
    message: str


class RagChatResponse(BaseModel):
    answer: str
    confidence_score: float = Field(default=0.5)
    recommended_next_step: Optional[str] = None
    sources: List[str] = Field(default_factory=list)

