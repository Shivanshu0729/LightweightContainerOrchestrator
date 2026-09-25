import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import init_db
from backend.app.api import containers, health, system
from backend.app.workers.monitor import monitor_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("orchestrator")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    init_db()

    logger.info("Running orchestrator startup state reconciliation against Docker...")
    monitor_worker.startup_reconciliation()

    logger.info("Starting background health monitoring worker...")
    monitor_worker.start()

    yield

    logger.info("Stopping background health monitoring worker...")
    monitor_worker.stop()

app = FastAPI(
    title="Lightweight Container Orchestrator",
    version="1.0.0",
    description="A lightweight Docker container orchestration platform with health checking and auto-restart.",
    lifespan=lifespan
)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(system.router)
app.include_router(containers.router)

@app.get("/")
def root():
    return {
        "service": "Lightweight Container Orchestrator",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
