from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db

from .agent import TriageAgent
from .schemas import TriageRequest, TriageResponse


router = APIRouter()
agent = TriageAgent()


@router.post("/run", response_model=TriageResponse)
def run_triage(request: TriageRequest, db: Session = Depends(get_db)):
    try:
        return agent.run(db, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check():
    return {"status": "Triage & Escalation Agent is online"}

