"""Docker container status collector — 'are my services down'"""

import json
import logging
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ContainerStatus:
    name: str
    state: str           # running / exited / restarting
    status: str           # raw status ("Up 7 days (healthy)")
    healthy: Optional[bool]  # None = no healthcheck
    image: str = ""

@dataclass
class DockerServicesState:
    containers: list[ContainerStatus] = field(default_factory=list)
    error: Optional[str] = None
    available: bool = True  # False when no docker CLI/socket exists on this host

    @property
    def total(self) -> int:
        return len(self.containers)

    @property
    def down(self) -> list[ContainerStatus]:
        return [c for c in self.containers
                if c.state != "running" or c.healthy is False]

    @property
    def degraded(self) -> int:
        return len(self.down)

    @property
    def healthy_count(self) -> int:
        return self.total - self.degraded


def _docker_available() -> bool:
    """Cheap docker availability check — CLI present + a local socket (or DOCKER_HOST)."""
    if shutil.which("docker") is None:
        return False
    if os.environ.get("DOCKER_HOST"):
        return True
    return os.path.exists("/var/run/docker.sock") or os.path.exists("/run/docker.sock")


def collect_docker_services() -> DockerServicesState:
    if not _docker_available():
        # No docker on this host (cloud VPS) — return an explicit empty state
        # instead of probing a missing CLI/socket.
        logger.warning("docker unavailable (no docker CLI or socket)")
        return DockerServicesState(
            containers=[],
            available=False,
            error="docker unavailable (no docker CLI or socket)",
        )
    try:
        out = subprocess.run(
            ["docker", "ps", "-a", "--format", "{{json .}}"],
            capture_output=True, text=True, timeout=10)
        if out.returncode != 0:
            return DockerServicesState(error=out.stderr.strip()[:200])

        containers = []
        for line in out.stdout.splitlines():
            if not line.strip():
                continue
            j = json.loads(line)
            status = j.get("Status", "")
            healthy: Optional[bool] = None
            if "(healthy)" in status:
                healthy = True
            elif "(unhealthy)" in status:
                healthy = False
            containers.append(ContainerStatus(
                name=j.get("Names", ""),
                state=j.get("State", ""),
                status=status,
                healthy=healthy,
                image=j.get("Image", ""),
            ))
        return DockerServicesState(
            containers=sorted(containers, key=lambda c: c.name))

    except subprocess.TimeoutExpired:
        return DockerServicesState(error="docker ps timed out")
    except Exception as e:
        return DockerServicesState(error=str(e)[:200])
