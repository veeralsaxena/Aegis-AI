from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db

from .agent import CDSAgent
from .schemas import CDSRequest, CDSResponse


router = APIRouter()
agent = CDSAgent()


@router.post("/run", response_model=CDSResponse)
def run_cds(request: CDSRequest, db: Session = Depends(get_db)):
    try:
        return agent.run(db, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check():
    return {"status": "CDS Agent is online"}

