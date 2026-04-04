from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db

from .agent import CareCoordinationAgent
from .schemas import CareCoordRequest, CareCoordResponse


router = APIRouter()
agent = CareCoordinationAgent()


@router.post("/run", response_model=CareCoordResponse)
def run_care_coord(request: CareCoordRequest, db: Session = Depends(get_db)):
    try:
        return agent.run(db, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check():
    return {"status": "Care Coordination Agent is online"}

