import uuid
from datetime import datetime, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from backend.app.models import ContainerModel, EventModel
from backend.app.services.recovery_manager import RecoveryManager
from backend.app.services.health_monitor import HealthCheckResult
from backend.app.config import Settings

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture
def db_session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_recovery_stops_container_when_desired_state_is_stopped(db_session, monkeypatch):
    stopped_called = []
    monkeypatch.setattr(
        "backend.app.services.recovery_manager.docker_manager.stop",
        lambda docker_id: stopped_called.append(docker_id)
    )

    container = ContainerModel(
        id=str(uuid.uuid4()),
        name="test-stop",
        image="alpine",
        docker_id="mock-docker-1",
        desired_state="stopped",
        actual_status="running",
        health_status="healthy",
        auto_restart=True
    )
    db_session.add(container)
    db_session.commit()

    manager = RecoveryManager()
    result = HealthCheckResult(is_healthy=True, actual_status="running", health_status="healthy")
    manager.reconcile(db_session, container, result)

    assert container.actual_status == "stopped"
    assert "mock-docker-1" in stopped_called

def test_recovery_exceeds_max_restart_attempts(db_session):
    container = ContainerModel(
        id=str(uuid.uuid4()),
        name="test-max-attempts",
        image="alpine",
        docker_id="mock-docker-2",
        desired_state="running",
        actual_status="restarting",
        health_status="unhealthy",
        auto_restart=True,
        restart_count=5
    )
    db_session.add(container)
    db_session.commit()

    manager = RecoveryManager()
    result = HealthCheckResult(is_healthy=False, actual_status="exited", health_status="unhealthy", detail="Process crashed")
    manager.reconcile(db_session, container, result)

    assert container.actual_status == "restart_failed"
    events = db_session.query(EventModel).filter(EventModel.container_id == container.id).all()
    assert any(e.event_type == "RESTART_LIMIT_REACHED" for e in events)

def test_recovery_respects_exponential_backoff(db_session, monkeypatch):
    restart_called = []
    monkeypatch.setattr(
        "backend.app.services.recovery_manager.docker_manager.inspect",
        lambda docker_id: {"State": {"Status": "exited"}}
    )
    monkeypatch.setattr(
        "backend.app.services.recovery_manager.docker_manager.restart",
        lambda docker_id: restart_called.append(docker_id)
    )

    container = ContainerModel(
        id=str(uuid.uuid4()),
        name="test-backoff",
        image="alpine",
        docker_id="mock-docker-3",
        desired_state="running",
        actual_status="exited",
        health_status="unhealthy",
        auto_restart=True,
        restart_count=1,
        last_restart_at=datetime.utcnow()
    )
    db_session.add(container)
    db_session.commit()

    manager = RecoveryManager()
    result = HealthCheckResult(is_healthy=False, actual_status="exited", health_status="unhealthy", detail="Exit code 1")
    manager.reconcile(db_session, container, result)

    assert len(restart_called) == 0
    assert container.restart_count == 1

def test_recovery_triggers_restart_after_backoff_elapses(db_session, monkeypatch):
    restart_called = []
    monkeypatch.setattr(
        "backend.app.services.recovery_manager.docker_manager.inspect",
        lambda docker_id: {"State": {"Status": "exited"}}
    )
    monkeypatch.setattr(
        "backend.app.services.recovery_manager.docker_manager.restart",
        lambda docker_id: restart_called.append(docker_id)
    )

    container = ContainerModel(
        id=str(uuid.uuid4()),
        name="test-backoff-elapsed",
        image="alpine",
        docker_id="mock-docker-4",
        desired_state="running",
        actual_status="exited",
        health_status="unhealthy",
        auto_restart=True,
        restart_count=1,
        last_restart_at=datetime.utcnow() - timedelta(seconds=60)
    )
    db_session.add(container)
    db_session.commit()

    manager = RecoveryManager()
    result = HealthCheckResult(is_healthy=False, actual_status="exited", health_status="unhealthy", detail="Exit code 1")
    manager.reconcile(db_session, container, result)

    assert len(restart_called) == 1
    assert container.restart_count == 2
    assert container.actual_status == "restarting"

def test_recovery_records_recovery_event_when_healthy(db_session):
    container = ContainerModel(
        id=str(uuid.uuid4()),
        name="test-recovered",
        image="alpine",
        docker_id="mock-docker-5",
        desired_state="running",
        actual_status="restarting",
        health_status="unhealthy",
        auto_restart=True,
        restart_count=2
    )
    db_session.add(container)
    db_session.commit()

    manager = RecoveryManager()
    result = HealthCheckResult(is_healthy=True, actual_status="running", health_status="healthy", detail="Container running")
    manager.reconcile(db_session, container, result)

    assert container.actual_status == "running"
    assert container.health_status == "healthy"
    events = db_session.query(EventModel).filter(EventModel.container_id == container.id).all()
    assert any(e.event_type == "CONTAINER_RECOVERED" for e in events)
