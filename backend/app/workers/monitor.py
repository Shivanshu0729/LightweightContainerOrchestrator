import asyncio
import logging
from datetime import datetime
from typing import Set
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models import ContainerModel, EventModel
from backend.app.services.docker_manager import docker_manager
from backend.app.services.health_monitor import health_monitor
from backend.app.services.recovery_manager import recovery_manager

logger = logging.getLogger("orchestrator.monitor")

class MonitorWorker:
    def __init__(self):
        self.is_running = False
        self._task = None
        self._sse_subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self._sse_subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._sse_subscribers.discard(queue)

    async def broadcast_event(self, data: str) -> None:
        dead_queues = set()
        for q in self._sse_subscribers:
            try:
                q.put_nowait(data)
            except Exception:
                dead_queues.add(q)
        for dq in dead_queues:
            self._sse_subscribers.discard(dq)

    def startup_reconciliation(self) -> None:
        db: Session = SessionLocal()
        try:
            containers = db.query(ContainerModel).all()
            for container in containers:
                try:
                    result = health_monitor.check_container_health(container)
                    recovery_manager.reconcile(db, container, result)
                except Exception as e:
                    logger.error(f"Error during startup reconciliation for {container.name}: {e}")
        finally:
            db.close()

    async def run_loop(self) -> None:
        self.is_running = True
        while self.is_running:
            try:
                await self._check_all_containers()
            except Exception as e:
                logger.error(f"Error in monitor worker cycle: {e}")
            await asyncio.sleep(settings.HEALTH_CHECK_INTERVAL)

    async def _check_all_containers(self) -> None:
        db: Session = SessionLocal()
        try:
            containers = db.query(ContainerModel).all()
            for container in containers:
                try:
                    result = health_monitor.check_container_health(container)
                    recovery_manager.reconcile(db, container, result)
                except Exception as e:
                    logger.error(f"Error checking container {container.name}: {e}")
            await self.broadcast_event("tick")
        finally:
            db.close()

    def start(self) -> None:
        if not self._task or self._task.done():
            self._task = asyncio.create_task(self.run_loop())

    def stop(self) -> None:
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()

monitor_worker = MonitorWorker()
