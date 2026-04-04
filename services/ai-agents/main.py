from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine
from app.models.base import Base
from app.agents.chart_prep import router as chart_prep_router
from app.agents.ambient_scribe import router as ambient_scribe_router
from app.agents.cds import router as cds_router
from app.agents.follow_up import router as follow_up_router
from app.agents.care_coord import router as care_coord_router
from app.agents.triage import router as triage_router
from app.agents.post_discharge_rag import router as post_discharge_rag_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables (in a real app, use Alembic migrations)
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup if needed
    
app = FastAPI(
    title="OmniCare AI Agents",
    description="Multi-agent orchestration platform back-end",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(chart_prep_router.router, prefix="/api/v1/agents/chart-prep")
app.include_router(ambient_scribe_router.router, prefix="/api/v1/agents/ambient-scribe")
app.include_router(cds_router.router, prefix="/api/v1/agents/cds")
app.include_router(follow_up_router.router, prefix="/api/v1/agents/follow-up")
app.include_router(care_coord_router.router, prefix="/api/v1/agents/care-coordination")
app.include_router(triage_router.router, prefix="/api/v1/agents/triage")
app.include_router(post_discharge_rag_router.router, prefix="/api/v1/agents/post-discharge-rag")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}
