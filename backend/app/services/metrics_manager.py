from typing import Optional, Dict, Any
from backend.app.services.docker_manager import docker_manager
from backend.app.schemas import ContainerStatsResponse

class MetricsManager:
    def get_container_metrics(self, docker_id: Optional[str]) -> ContainerStatsResponse:
        if not docker_id:
            return ContainerStatsResponse(is_available=False, detail="Container is not associated with a Docker ID.")

        raw = docker_manager.get_raw_stats(docker_id)
        if not raw:
            return ContainerStatsResponse(is_available=False, detail="Resource metrics are currently unavailable from Docker.")

        try:
            cpu_stats = raw.get("cpu_stats", {})
            precpu_stats = raw.get("precpu_stats", {})

            cpu_delta = cpu_stats.get("cpu_usage", {}).get("total_usage", 0) - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
            system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)
            online_cpus = cpu_stats.get("online_cpus") or len(cpu_stats.get("cpu_usage", {}).get("percpu_usage") or [1])
            if online_cpus <= 0:
                online_cpus = 1

            cpu_percent: Optional[float] = None
            if system_delta > 0 and cpu_delta >= 0:
                cpu_percent = round((cpu_delta / system_delta) * online_cpus * 100.0, 2)

            memory_stats = raw.get("memory_stats", {})
            memory_usage = memory_stats.get("usage")
            memory_limit = memory_stats.get("limit")

            memory_percent: Optional[float] = None
            if memory_usage and memory_limit and memory_limit > 0:
                memory_percent = round((memory_usage / memory_limit) * 100.0, 2)

            networks = raw.get("networks", {})
            rx_bytes = sum(net.get("rx_bytes", 0) for net in networks.values()) if networks else None
            tx_bytes = sum(net.get("tx_bytes", 0) for net in networks.values()) if networks else None

            blkio_stats = raw.get("blkio_stats", {})
            io_bytes = blkio_stats.get("io_service_bytes_recursive") or []
            read_bytes = sum(item.get("value", 0) for item in io_bytes if item.get("op") == "Read") if io_bytes else None
            write_bytes = sum(item.get("value", 0) for item in io_bytes if item.get("op") == "Write") if io_bytes else None

            return ContainerStatsResponse(
                cpu_percent=cpu_percent,
                memory_usage_bytes=memory_usage,
                memory_limit_bytes=memory_limit,
                memory_percent=memory_percent,
                network_rx_bytes=rx_bytes,
                network_tx_bytes=tx_bytes,
                block_read_bytes=read_bytes,
                block_write_bytes=write_bytes,
                is_available=True
            )
        except Exception as e:
            return ContainerStatsResponse(is_available=False, detail=f"Failed to parse Docker stats: {str(e)}")

metrics_manager = MetricsManager()
