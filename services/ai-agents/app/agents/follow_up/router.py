from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db

from .agent import FollowUpCarePlanAgent
from .schemas import FollowUpCarePlanRequest, FollowUpCarePlanResponse


router = APIRouter()
agent = FollowUpCarePlanAgent()


@router.post("/run", response_model=FollowUpCarePlanResponse)
def run_follow_up_care_plan(
    request: FollowUpCarePlanRequest,
    db: Session = Depends(get_db),
):
    try:
        return agent.run(db, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check():
    return {"status": "Follow-Up & Care Plan Agent is online"}

