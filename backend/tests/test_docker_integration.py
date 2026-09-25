import time
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base, SessionLocal, init_db
from backend.app.models import ContainerModel, EventModel
from backend.app.services.docker_manager import docker_manager
from backend.app.services.health_monitor import health_monitor
from backend.app.services.recovery_manager import recovery_manager

@pytest.mark.skipif(not docker_manager.is_connected(), reason="Docker daemon is not accessible.")
def test_real_docker_auto_recovery():
    init_db()
    test_name = "orch-integration-test-nginx"

    existing = docker_manager.find_container_by_name(test_name)
    if existing:
        docker_manager.remove(existing.id, force=True)

    db = SessionLocal()
    try:
        old_record = db.query(ContainerModel).filter(ContainerModel.name == test_name).first()
        if old_record:
            db.delete(old_record)
            db.commit()

        docker_id = docker_manager.create_and_start(
            name=test_name,
            image="nginx:alpine",
            host_port=None,
            container_port=80,
            env_vars={}
        )
        assert docker_id is not None

        container = ContainerModel(
            name=test_name,
            image="nginx:alpine",
            docker_id=docker_id,
            container_port=80,
            auto_restart=True,
            desired_state="running",
            actual_status="running",
            health_status="healthy",
            restart_count=0
        )
        db.add(container)
        db.commit()
        db.refresh(container)

        inspect_data = docker_manager.inspect(docker_id)
        assert inspect_data is not None
        assert inspect_data["State"]["Status"] == "running"

        result = health_monitor.check_container_health(container)
        assert result.is_healthy is True
        assert result.actual_status == "running"

        raw_client = docker_manager.get_client()
        raw_client.containers.get(docker_id).kill()

        time.sleep(1)

        result_after_kill = health_monitor.check_container_health(container)
        assert result_after_kill.is_healthy is False
        assert result_after_kill.actual_status == "exited"

        recovery_manager.reconcile(db, container, result_after_kill)
        db.refresh(container)

        assert container.restart_count == 1
        assert container.actual_status in ["restarting", "running"]

        time.sleep(2)
        result_recovered = health_monitor.check_container_health(container)
        recovery_manager.reconcile(db, container, result_recovered)
        db.refresh(container)

        assert container.actual_status == "running"
        assert container.health_status == "healthy"

    finally:
        try:
            c = docker_manager.find_container_by_name(test_name)
            if c:
                docker_manager.remove(c.id, force=True)
        except Exception:
            pass

        record = db.query(ContainerModel).filter(ContainerModel.name == test_name).first()
        if record:
            db.delete(record)
            db.commit()
        db.close()
