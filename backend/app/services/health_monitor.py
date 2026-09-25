from typing import Tuple, Optional
import httpx
from backend.app.models import ContainerModel
from backend.app.services.docker_manager import docker_manager

class HealthCheckResult:
    def __init__(self, is_healthy: bool, actual_status: str, health_status: str, detail: Optional[str] = None):
        self.is_healthy = is_healthy
        self.actual_status = actual_status
        self.health_status = health_status
        self.detail = detail

class HealthMonitor:
    def check_container_health(self, container: ContainerModel) -> HealthCheckResult:
        if not container.docker_id:
            return HealthCheckResult(
                is_healthy=False,
                actual_status="stopped",
                health_status="unknown",
                detail="No Docker container ID associated."
            )

        attrs = docker_manager.inspect(container.docker_id)
        if not attrs:
            return HealthCheckResult(
                is_healthy=False,
                actual_status="exited",
                health_status="unhealthy",
                detail="Container missing from Docker Engine."
            )

        state = attrs.get("State", {})
        status = state.get("Status", "unknown")
        exit_code = state.get("ExitCode", 0)

        if status != "running":
            return HealthCheckResult(
                is_healthy=False,
                actual_status=status,
                health_status="unhealthy",
                detail=f"Container is {status} (exit code: {exit_code})."
            )

        health_obj = state.get("Health")
        if health_obj:
            docker_health = health_obj.get("Status")
            if docker_health == "unhealthy":
                logs = health_obj.get("Log", [])
                last_err = logs[-1].get("Output", "") if logs else "Healthcheck reported unhealthy"
                return HealthCheckResult(
                    is_healthy=False,
                    actual_status="running",
                    health_status="unhealthy",
                    detail=f"Docker healthcheck failed: {last_err.strip()}"
                )
            elif docker_health == "starting":
                return HealthCheckResult(
                    is_healthy=True,
                    actual_status="running",
                    health_status="starting",
                    detail="Container is starting up (health check pending)."
                )

        if container.health_check_type == "http" and container.host_port:
            path = container.health_check_path or "/"
            if not path.startswith("/"):
                path = f"/{path}"
            url = f"http://127.0.0.1:{container.host_port}{path}"
            timeout = container.health_check_timeout or 3

            try:
                with httpx.Client(timeout=timeout) as client:
                    resp = client.get(url)
                    if 200 <= resp.status_code < 400:
                        return HealthCheckResult(
                            is_healthy=True,
                            actual_status="running",
                            health_status="healthy",
                            detail=f"HTTP probe {url} succeeded with {resp.status_code}."
                        )
                    else:
                        return HealthCheckResult(
                            is_healthy=False,
                            actual_status="running",
                            health_status="unhealthy",
                            detail=f"HTTP probe {url} returned HTTP {resp.status_code}."
                        )
            except Exception as e:
                return HealthCheckResult(
                    is_healthy=False,
                    actual_status="running",
                    health_status="unhealthy",
                    detail=f"HTTP probe {url} connection failed: {str(e)}"
                )

        return HealthCheckResult(
            is_healthy=True,
            actual_status="running",
            health_status="healthy",
            detail="Container is running."
        )

health_monitor = HealthMonitor()
