import json
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.models import ContainerModel, EventModel
from backend.app.services.docker_manager import docker_manager
from backend.app.services.health_monitor import HealthCheckResult

class RecoveryManager:
    def reconcile(self, db: Session, container: ContainerModel, health_result: HealthCheckResult) -> None:
        now = datetime.utcnow()

        if container.desired_state == "stopped":
            if health_result.actual_status == "running" and container.docker_id:
                try:
                    docker_manager.stop(container.docker_id)
                except Exception:
                    pass
            container.actual_status = "stopped"
            container.health_status = "unknown"
            db.commit()
            return

        if health_result.is_healthy:
            was_unhealthy = container.actual_status in ["exited", "restarting", "restart_failed", "error"] or container.health_status == "unhealthy"
            container.actual_status = "running"
            container.health_status = health_result.health_status

            if was_unhealthy:
                event = EventModel(
                    container_id=container.id,
                    event_type="CONTAINER_RECOVERED",
                    reason="Container has recovered and is now healthy.",
                    previous_state="unhealthy",
                    new_state="healthy",
                    timestamp=now
                )
                db.add(event)
            db.commit()
            return

        is_new_failure = container.health_status != "unhealthy" and container.actual_status not in ["exited", "restart_failed"]
        if is_new_failure:
            event = EventModel(
                container_id=container.id,
                event_type="HEALTH_CHECK_FAILED",
                reason=health_result.detail or "Health check failed.",
                previous_state=container.actual_status,
                new_state="unhealthy",
                timestamp=now
            )
            db.add(event)
            container.last_failure_at = now

        container.actual_status = health_result.actual_status
        container.health_status = health_result.health_status

        if not container.auto_restart:
            db.commit()
            return

        if container.restart_count >= settings.MAX_RESTART_ATTEMPTS:
            if container.actual_status != "restart_failed":
                container.actual_status = "restart_failed"
                event = EventModel(
                    container_id=container.id,
                    event_type="RESTART_LIMIT_REACHED",
                    reason=f"Exceeded maximum restart attempts ({settings.MAX_RESTART_ATTEMPTS}). Automatic recovery stopped.",
                    previous_state="restarting",
                    new_state="restart_failed",
                    timestamp=now
                )
                db.add(event)
                db.commit()
            return

        backoff_seconds = min(settings.RESTART_BACKOFF_BASE * (2 ** container.restart_count), 300)
        if container.last_restart_at:
            elapsed = (now - container.last_restart_at).total_seconds()
            if elapsed < backoff_seconds:
                db.commit()
                return

        container.restart_count += 1
        container.last_restart_at = now
        container.actual_status = "restarting"

        event = EventModel(
            container_id=container.id,
            event_type="AUTO_RESTART",
            reason=f"Attempting automatic restart {container.restart_count}/{settings.MAX_RESTART_ATTEMPTS} (backoff: {backoff_seconds}s). Cause: {health_result.detail}",
            previous_state=health_result.actual_status,
            new_state="restarting",
            timestamp=now
        )
        db.add(event)
        db.commit()

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
                db.commit()
        except Exception as e:
            error_event = EventModel(
                container_id=container.id,
                event_type="AUTO_RESTART_FAILED",
                reason=f"Failed to execute auto-restart: {str(e)}",
                previous_state="restarting",
                new_state="error",
                timestamp=datetime.utcnow()
            )
            container.actual_status = "error"
            db.add(error_event)
            db.commit()

recovery_manager = RecoveryManager()
