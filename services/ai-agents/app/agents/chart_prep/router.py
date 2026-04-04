from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from .schemas import ChartPrepRequest, ChartPrepResponse
from .agent import ChartPrepAgent

router = APIRouter()
agent = ChartPrepAgent()

@router.post("/run", response_model=ChartPrepResponse)
def run_chart_prep(request: ChartPrepRequest, db: Session = Depends(get_db)):
    try:
        response = agent.run(db, request)
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
def health_check():
    return {"status": "Chart Prep Agent is online"}
