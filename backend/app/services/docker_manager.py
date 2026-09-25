import json
from typing import Optional, Dict, Any, Tuple
import docker
from docker.errors import DockerException, NotFound, APIError, ImageNotFound

class DockerManager:
    def __init__(self):
        self._client: Optional[docker.DockerClient] = None

    def get_client(self) -> docker.DockerClient:
        if self._client is not None:
            return self._client
        try:
            self._client = docker.from_env()
            self._client.ping()
            return self._client
        except Exception:
            try:
                self._client = docker.DockerClient(base_url="npipe:////./pipe/docker_engine")
                self._client.ping()
                return self._client
            except Exception as e:
                self._client = None
                raise RuntimeError(f"Unable to connect to Docker daemon: {str(e)}")

    def is_connected(self) -> bool:
        try:
            client = self.get_client()
            return client.ping()
        except Exception:
            return False

    def get_version_info(self) -> Dict[str, Any]:
        try:
            client = self.get_client()
            return client.version()
        except Exception:
            return {}

    def pull_image(self, image: str) -> None:
        client = self.get_client()
        try:
            if ":" not in image:
                image = f"{image}:latest"
            client.images.pull(image)
        except ImageNotFound as e:
            raise ValueError(f"Docker image '{image}' not found: {str(e)}")
        except APIError as e:
            raise RuntimeError(f"Docker API error while pulling image '{image}': {str(e)}")

    def create_and_start(
        self,
        name: str,
        image: str,
        host_port: Optional[int] = None,
        container_port: Optional[int] = None,
        env_vars: Optional[Dict[str, str]] = None
    ) -> str:
        client = self.get_client()

        existing = self.find_container_by_name(name)
        if existing:
            raise ValueError(f"A container with name '{name}' already exists in Docker.")

        self.pull_image(image)

        port_bindings = {}
        if host_port and container_port:
            port_bindings[f"{container_port}/tcp"] = host_port

        labels = {
            "managed-by": "lightweight-orchestrator",
            "orchestrator-name": name
        }

        try:
            container = client.containers.create(
                image=image,
                name=name,
                ports=port_bindings if port_bindings else None,
                environment=env_vars or {},
                labels=labels,
                detach=True
            )
            container.start()
            return container.id
        except APIError as e:
            raise RuntimeError(f"Failed to create or start container '{name}': {str(e)}")

    def start(self, docker_id: str) -> None:
        client = self.get_client()
        try:
            container = client.containers.get(docker_id)
            container.start()
        except NotFound:
            raise ValueError(f"Container '{docker_id}' not found in Docker.")
        except APIError as e:
            raise RuntimeError(f"Failed to start container '{docker_id}': {str(e)}")

    def stop(self, docker_id: str, timeout: int = 10) -> None:
        client = self.get_client()
        try:
            container = client.containers.get(docker_id)
            container.stop(timeout=timeout)
        except NotFound:
            return
        except APIError as e:
            raise RuntimeError(f"Failed to stop container '{docker_id}': {str(e)}")

    def restart(self, docker_id: str, timeout: int = 10) -> None:
        client = self.get_client()
        try:
            container = client.containers.get(docker_id)
            container.restart(timeout=timeout)
        except NotFound:
            raise ValueError(f"Container '{docker_id}' not found in Docker.")
        except APIError as e:
            raise RuntimeError(f"Failed to restart container '{docker_id}': {str(e)}")

    def remove(self, docker_id: str, force: bool = True) -> None:
        client = self.get_client()
        try:
            container = client.containers.get(docker_id)
            container.remove(force=force)
        except NotFound:
            return
        except APIError as e:
            raise RuntimeError(f"Failed to remove container '{docker_id}': {str(e)}")

    def inspect(self, docker_id: str) -> Optional[Dict[str, Any]]:
        client = self.get_client()
        try:
            container = client.containers.get(docker_id)
            container.reload()
            return container.attrs
        except NotFound:
            return None
        except Exception:
            return None

    def find_container_by_name(self, name: str) -> Optional[Any]:
        client = self.get_client()
        try:
            containers = client.containers.list(all=True, filters={"name": f"^{name}$"})
            for c in containers:
                if c.name == name or c.name == f"/{name}":
                    return c
            return None
        except Exception:
            return None

    def get_logs(self, docker_id: str, tail: int = 200) -> str:
        client = self.get_client()
        try:
            container = client.containers.get(docker_id)
            raw = container.logs(tail=tail, stdout=True, stderr=True)
            return raw.decode("utf-8", errors="replace")
        except NotFound:
            return "Container not found in Docker."
        except Exception as e:
            return f"Error retrieving logs: {str(e)}"

    def get_raw_stats(self, docker_id: str) -> Optional[Dict[str, Any]]:
        client = self.get_client()
        try:
            container = client.containers.get(docker_id)
            return container.stats(stream=False)
        except Exception:
            return None

docker_manager = DockerManager()
