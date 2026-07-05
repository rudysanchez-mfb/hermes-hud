"""Pipeline API routes — debrid, music, docker services."""

from fastapi import APIRouter

from backend.collectors.debrid import collect_debrid
from backend.collectors.music import collect_music
from backend.collectors.docker_services import collect_docker_services
from .serialize import to_dict

router = APIRouter()


@router.get("/pipeline/debrid")
def pipeline_debrid():
    return to_dict(collect_debrid())

@router.get("/pipeline/music")
def pipeline_music():
    return to_dict(collect_music())

@router.get("/services/docker")
def services_docker():
    return to_dict(collect_docker_services())
