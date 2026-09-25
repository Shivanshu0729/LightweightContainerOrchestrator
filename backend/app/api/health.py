from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import ContainerModel
from backend.app.schemas import OrchestratorHealthResponse
from backend.app.services.docker_manager import docker_manager

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("", response_model=OrchestratorHealthResponse)
def get_health(db: Session = Depends(get_db)):
    connected = docker_manager.is_connected()
    version_info = docker_manager.get_version_info() if connected else {}
    version_str = version_info.get("Version")
    count = db.query(ContainerModel).count()

    return OrchestratorHealthResponse(
        status="ok" if connected else "degraded",
        docker_connected=connected,
        docker_version=version_str,
        containers_managed=count
    )
