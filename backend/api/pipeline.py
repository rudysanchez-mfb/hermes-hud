"""Pipeline API routes — debrid, music, docker services."""

from typing import Optional
from fastapi import APIRouter

from backend.collectors.debrid import collect_debrid
from backend.collectors.music import collect_music, apply_enricher_run_filter
from backend.collectors.docker_services import collect_docker_services
from .serialize import to_dict

router = APIRouter()


@router.get("/pipeline/debrid")
def pipeline_debrid():
    return to_dict(collect_debrid())

@router.get("/pipeline/music")
def pipeline_music(enricher_run: Optional[str] = None):
    state = collect_music()
    if enricher_run:
        apply_enricher_run_filter(state, enricher_run)
    return to_dict(state)

@router.get("/services/docker")
def services_docker():
    return to_dict(collect_docker_services())
