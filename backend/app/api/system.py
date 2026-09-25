import asyncio
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database import get_db
from backend.app.models import ContainerModel
from backend.app.schemas import SystemStatsResponse
from backend.app.services.docker_manager import docker_manager
from backend.app.workers.monitor import monitor_worker

router = APIRouter(prefix="/api/system", tags=["system"])

@router.get("/stats", response_model=SystemStatsResponse)
def get_system_stats(db: Session = Depends(get_db)):
    containers = db.query(ContainerModel).all()
    total = len(containers)
    running = sum(1 for c in containers if c.actual_status == "running")
    healthy = sum(1 for c in containers if c.health_status == "healthy")
    unhealthy = sum(1 for c in containers if c.health_status == "unhealthy")
    failed = sum(1 for c in containers if c.actual_status in ["restart_failed", "error", "dead"])
    total_restarts = sum(c.restart_count for c in containers)

    connected = docker_manager.is_connected()
    version_info = docker_manager.get_version_info() if connected else {}

    return SystemStatsResponse(
        total_containers=total,
        running_containers=running,
        healthy_containers=healthy,
        unhealthy_containers=unhealthy,
        failed_containers=failed,
        total_restarts=total_restarts,
        docker_connected=connected,
        docker_version=version_info.get("Version")
    )

@router.get("/stream")
async def event_stream():
    queue = monitor_worker.subscribe()

    async def event_generator():
        try:
            yield "data: connected\n\n"
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            monitor_worker.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
