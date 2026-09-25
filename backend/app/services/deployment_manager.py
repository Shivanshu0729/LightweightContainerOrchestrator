import json
import time
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.models import ContainerModel, EventModel
from backend.app.services.docker_manager import docker_manager

class DeploymentManager:
    def rolling_update(self, db: Session, container: ContainerModel, new_image: str) -> None:
        old_image = container.image
        old_docker_id = container.docker_id

        docker_manager.pull_image(new_image)

        test_container_name = f"{container.name}-update-probe-{int(time.time())}"
        test_docker_id = None
        env_dict = json.loads(container.env_vars) if container.env_vars else {}

        try:
            test_docker_id = docker_manager.create_and_start(
                name=test_container_name,
                image=new_image,
                host_port=None,
                container_port=container.container_port,
                env_vars=env_dict
            )

            time.sleep(2)
            attrs = docker_manager.inspect(test_docker_id)
            if not attrs or attrs.get("State", {}).get("Status") != "running":
                raise RuntimeError(f"New image '{new_image}' failed health check during staging.")

        finally:
            if test_docker_id:
                try:
                    docker_manager.remove(test_docker_id, force=True)
                except Exception:
                    pass

        if old_docker_id:
            try:
                docker_manager.remove(old_docker_id, force=True)
            except Exception:
                pass

        new_docker_id = docker_manager.create_and_start(
            name=container.name,
            image=new_image,
            host_port=container.host_port,
            container_port=container.container_port,
            env_vars=env_dict
        )

        container.image = new_image
        container.docker_id = new_docker_id
        container.actual_status = "running"
        container.health_status = "healthy"
        container.restart_count = 0
        container.last_restart_at = datetime.utcnow()

        event = EventModel(
            container_id=container.id,
            event_type="UPDATE",
            reason=f"Rolling update succeeded: updated image from '{old_image}' to '{new_image}'.",
            previous_state=old_image,
            new_state=new_image,
            timestamp=datetime.utcnow()
        )
        db.add(event)
        db.commit()

deployment_manager = DeploymentManager()
