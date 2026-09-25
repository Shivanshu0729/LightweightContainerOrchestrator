import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class ContainerModel(Base):
    __tablename__ = "containers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False, index=True)
    image = Column(String(255), nullable=False)
    docker_id = Column(String(128), nullable=True, index=True)
    host_port = Column(Integer, nullable=True)
    container_port = Column(Integer, nullable=True)
    env_vars = Column(Text, nullable=True, default="{}")
    auto_restart = Column(Boolean, default=True, nullable=False)
    desired_state = Column(String(20), default="running", nullable=False)
    actual_status = Column(String(30), default="pending", nullable=False)
    health_status = Column(String(30), default="unknown", nullable=False)
    restart_count = Column(Integer, default=0, nullable=False)
    last_restart_at = Column(DateTime, nullable=True)
    last_failure_at = Column(DateTime, nullable=True)
    health_check_type = Column(String(20), default="docker", nullable=True)
    health_check_path = Column(String(255), nullable=True)
    health_check_timeout = Column(Integer, default=3, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    events = relationship("EventModel", back_populates="container", cascade="all, delete-orphan", order_by="desc(EventModel.timestamp)")

class EventModel(Base):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    container_id = Column(String(36), ForeignKey("containers.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    previous_state = Column(String(50), nullable=True)
    new_state = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    container = relationship("ContainerModel", back_populates="events")
