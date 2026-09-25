import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.main import app
from backend.app.database import Base, get_db

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_api_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "docker_connected" in data
    assert "containers_managed" in data

def test_api_system_stats():
    response = client.get("/api/system/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_containers" in data
    assert "running_containers" in data
    assert "healthy_containers" in data

def test_create_container_validation_errors():
    response = client.post("/api/containers", json={
        "name": "invalid name with spaces!",
        "image": "nginx"
    })
    assert response.status_code == 422

    response = client.post("/api/containers", json={
        "name": "valid-name",
        "image": "nginx",
        "port": 999999
    })
    assert response.status_code == 422

def test_container_not_found():
    response = client.get("/api/containers/non-existent-id")
    assert response.status_code == 404
