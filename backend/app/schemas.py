from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict

class HealthCheckConfig(BaseModel):
    type: str = Field(default="docker", description="docker, http, or none")
    path: Optional[str] = Field(default="/", description="Path for HTTP health check")
    timeout: int = Field(default=3, ge=1, le=60)

class ContainerCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_\-]+$")
    image: str = Field(..., min_length=1, max_length=255)
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    container_port: Optional[int] = Field(default=None, ge=1, le=65535)
    env_vars: Optional[Dict[str, str]] = Field(default_factory=dict)
    auto_restart: bool = Field(default=True)
    health_check: Optional[HealthCheckConfig] = None

class ContainerUpdateRequest(BaseModel):
    image: str = Field(..., min_length=1, max_length=255)

class EventResponse(BaseModel):
    id: str
    container_id: str
    event_type: str
    reason: Optional[str] = None
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class ContainerResponse(BaseModel):
    id: str
    name: str
    image: str
    docker_id: Optional[str] = None
    host_port: Optional[int] = None
    container_port: Optional[int] = None
    env_vars: Dict[str, str] = Field(default_factory=dict)
    auto_restart: bool
    desired_state: str
    actual_status: str
    health_status: str
    restart_count: int
    last_restart_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    health_check_type: Optional[str] = None
    health_check_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ContainerDetailResponse(ContainerResponse):
    events: List[EventResponse] = Field(default_factory=list)

class ContainerStatsResponse(BaseModel):
    cpu_percent: Optional[float] = None
    memory_usage_bytes: Optional[int] = None
    memory_limit_bytes: Optional[int] = None
    memory_percent: Optional[float] = None
    network_rx_bytes: Optional[int] = None
    network_tx_bytes: Optional[int] = None
    block_read_bytes: Optional[int] = None
    block_write_bytes: Optional[int] = None
    is_available: bool = False
    detail: Optional[str] = None

class ContainerLogsResponse(BaseModel):
    container_id: str
    name: str
    logs: str

class SystemStatsResponse(BaseModel):
    total_containers: int
    running_containers: int
    healthy_containers: int
    unhealthy_containers: int
    failed_containers: int
    total_restarts: int
    docker_connected: bool
    docker_version: Optional[str] = None

class OrchestratorHealthResponse(BaseModel):
    status: str
    docker_connected: bool
    docker_version: Optional[str] = None
    containers_managed: int
