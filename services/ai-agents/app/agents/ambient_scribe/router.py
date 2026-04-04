from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db

from .agent import AmbientScribeAgent
from .schemas import AmbientScribeRequest, AmbientScribeResponse


router = APIRouter()
agent = AmbientScribeAgent()


@router.post("/run", response_model=AmbientScribeResponse)
def run_ambient_scribe(request: AmbientScribeRequest, db: Session = Depends(get_db)):
    try:
        return agent.run(db, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check():
    return {"status": "Ambient Scribe Agent is online"}

