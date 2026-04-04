from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db

from .agent import PostDischargeRagAgent
from .schemas import RagChatRequest, RagChatResponse


router = APIRouter()
agent = PostDischargeRagAgent()


@router.post("/run", response_model=RagChatResponse)
def run_post_discharge_rag(request: RagChatRequest, db: Session = Depends(get_db)):
    try:
        return agent.run(db, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check():
    return {"status": "Post-Discharge RAG Chatbot Agent is online"}

