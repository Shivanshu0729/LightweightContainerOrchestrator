import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import ContainerModel, EventModel
from backend.app.schemas import (
    ContainerCreateRequest,
    ContainerResponse,
    ContainerDetailResponse,
    ContainerUpdateRequest,
    ContainerLogsResponse,
    ContainerStatsResponse,
    EventResponse,
)
from backend.app.services.docker_manager import docker_manager
from backend.app.services.metrics_manager import metrics_manager
from backend.app.services.deployment_manager import deployment_manager
from backend.app.services.health_monitor import health_monitor

router = APIRouter(prefix="/api/containers", tags=["containers"])

def _format_container_response(c: ContainerModel) -> dict:
    env_dict = json.loads(c.env_vars) if c.env_vars else {}
    return {
        "id": c.id,
        "name": c.name,
        "image": c.image,
        "docker_id": c.docker_id,
        "host_port": c.host_port,
        "container_port": c.container_port,
        "env_vars": env_dict,
        "auto_restart": c.auto_restart,
        "desired_state": c.desired_state,
        "actual_status": c.actual_status,
        "health_status": c.health_status,
        "restart_count": c.restart_count,
        "last_restart_at": c.last_restart_at,
        "last_failure_at": c.last_failure_at,
        "health_check_type": c.health_check_type,
        "health_check_path": c.health_check_path,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }

@router.get("", response_model=List[ContainerResponse])
def list_containers(db: Session = Depends(get_db)):
    containers = db.query(ContainerModel).order_by(ContainerModel.created_at.desc()).all()
    return [_format_container_response(c) for c in containers]

@router.post("", response_model=ContainerResponse, status_code=status.HTTP_201_CREATED)
def create_container(payload: ContainerCreateRequest, db: Session = Depends(get_db)):
    existing = db.query(ContainerModel).filter(ContainerModel.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Container with name '{payload.name}' is already registered.")

    try:
        docker_id = docker_manager.create_and_start(
            name=payload.name,
            image=payload.image,
            host_port=payload.port,
            container_port=payload.container_port,
            env_vars=payload.env_vars
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=500, detail=str(re))

    health_type = payload.health_check.type if payload.health_check else "docker"
    health_path = payload.health_check.path if payload.health_check else "/"
    health_timeout = payload.health_check.timeout if payload.health_check else 3

    container = ContainerModel(
        name=payload.name,
        image=payload.image,
        docker_id=docker_id,
        host_port=payload.port,
        container_port=payload.container_port,
        env_vars=json.dumps(payload.env_vars or {}),
        auto_restart=payload.auto_restart,
        desired_state="running",
        actual_status="running",
        health_status="healthy",
        restart_count=0,
        health_check_type=health_type,
        health_check_path=health_path,
        health_check_timeout=health_timeout,
    )
    db.add(container)
    db.flush()

    event = EventModel(
        container_id=container.id,
        event_type="DEPLOYMENT",
        reason=f"Container deployed with image '{payload.image}'.",
        previous_state=None,
        new_state="running",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(container)

    return _format_container_response(container)

@router.get("/{container_id}", response_model=ContainerDetailResponse)
def get_container(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    res = _format_container_response(container)
    res["events"] = [
        EventResponse(
            id=e.id,
            container_id=e.container_id,
            event_type=e.event_type,
            reason=e.reason,
            previous_state=e.previous_state,
            new_state=e.new_state,
            timestamp=e.timestamp
        )
        for e in container.events
    ]
    return res

@router.post("/{container_id}/start", response_model=ContainerResponse)
def start_container(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    try:
        if container.docker_id and docker_manager.inspect(container.docker_id):
            docker_manager.start(container.docker_id)
        else:
            env_dict = json.loads(container.env_vars) if container.env_vars else {}
            new_id = docker_manager.create_and_start(
                name=container.name,
                image=container.image,
                host_port=container.host_port,
                container_port=container.container_port,
                env_vars=env_dict
            )
            container.docker_id = new_id

        container.desired_state = "running"
        container.actual_status = "running"
        container.health_status = "healthy"

        event = EventModel(
            container_id=container.id,
            event_type="CONTAINER_STARTED",
            reason="Container started manually.",
            previous_state="stopped",
            new_state="running",
            timestamp=datetime.utcnow()
        )
        db.add(event)
        db.commit()
        db.refresh(container)
        return _format_container_response(container)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{container_id}/stop", response_model=ContainerResponse)
def stop_container(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    if container.docker_id:
        try:
            docker_manager.stop(container.docker_id)
        except Exception:
            pass

    container.desired_state = "stopped"
    container.actual_status = "stopped"
    container.health_status = "unknown"

    event = EventModel(
        container_id=container.id,
        event_type="CONTAINER_STOPPED",
        reason="Container stopped manually by user.",
        previous_state="running",
        new_state="stopped",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(container)
    return _format_container_response(container)

@router.post("/{container_id}/restart", response_model=ContainerResponse)
def restart_container(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    try:
        if container.docker_id and docker_manager.inspect(container.docker_id):
            docker_manager.restart(container.docker_id)
        else:
            env_dict = json.loads(container.env_vars) if container.env_vars else {}
            new_id = docker_manager.create_and_start(
                name=container.name,
                image=container.image,
                host_port=container.host_port,
                container_port=container.container_port,
                env_vars=env_dict
            )
            container.docker_id = new_id

        container.desired_state = "running"
        container.actual_status = "running"
        container.health_status = "healthy"
        container.last_restart_at = datetime.utcnow()

        event = EventModel(
            container_id=container.id,
            event_type="MANUAL_RESTART",
            reason="Container restarted manually by user.",
            previous_state=container.actual_status,
            new_state="running",
            timestamp=datetime.utcnow()
        )
        db.add(event)
        db.commit()
        db.refresh(container)
        return _format_container_response(container)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{container_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_container(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    if container.docker_id:
        try:
            docker_manager.remove(container.docker_id, force=True)
        except Exception:
            pass

    db.delete(container)
    db.commit()
    return None

@router.get("/{container_id}/logs", response_model=ContainerLogsResponse)
def get_logs(container_id: str, tail: int = Query(default=200, ge=10, le=2000), db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    if not container.docker_id:
        return ContainerLogsResponse(container_id=container.id, name=container.name, logs="No Docker ID associated.")

    logs = docker_manager.get_logs(container.docker_id, tail=tail)
    return ContainerLogsResponse(container_id=container.id, name=container.name, logs=logs)

@router.get("/{container_id}/stats", response_model=ContainerStatsResponse)
def get_stats(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    return metrics_manager.get_container_metrics(container.docker_id)

@router.get("/{container_id}/events", response_model=List[EventResponse])
def get_events(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    events = db.query(EventModel).filter(EventModel.container_id == container.id).order_by(EventModel.timestamp.desc()).all()
    return [
        EventResponse(
            id=e.id,
            container_id=e.container_id,
            event_type=e.event_type,
            reason=e.reason,
            previous_state=e.previous_state,
            new_state=e.new_state,
            timestamp=e.timestamp
        )
        for e in events
    ]

@router.post("/{container_id}/update", response_model=ContainerResponse)
def update_container_image(container_id: str, payload: ContainerUpdateRequest, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    try:
        deployment_manager.rolling_update(db, container, payload.image)
        db.refresh(container)
        return _format_container_response(container)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rolling update failed: {str(e)}")

@router.post("/{container_id}/reset-restarts", response_model=ContainerResponse)
def reset_restarts(container_id: str, db: Session = Depends(get_db)):
    container = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found.")

    container.restart_count = 0
    if container.actual_status == "restart_failed":
        container.actual_status = "stopped"
    db.commit()
    db.refresh(container)
    return _format_container_response(container)
