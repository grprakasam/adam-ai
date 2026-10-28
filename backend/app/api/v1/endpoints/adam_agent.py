"""
ADaM Agent API - agentic generation with human sign-off

POST /adam-agent/runs                 start a run (pauses at human review)
GET  /adam-agent/runs/{run_id}        current state / review packet
POST /adam-agent/runs/{run_id}/review approve or reject (reviewer = signed-in user)
GET  /adam-agent/runs/{run_id}/audit  audit records for the run
GET  /adam-agent/audit/verify         verify the hash chain of the audit log

Auto-approval is deliberately not exposed here: only the offline benchmark/CI
runner may skip human review, and it can never approve a run that failed checks.
"""

import os
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field, model_validator

from app.config import settings
from app.core.auth import User, get_current_active_user
from app.modules.adam_agent.audit import AuditLog, verify_chain
from app.modules.adam_agent.checkpoints import PersistentSqliteSaver
from app.modules.adam_agent.components import LLMCodeGenerator, ReplayGenerator, RExecutor, StaticValidator
from app.modules.adam_agent.paths import safe_path
from app.modules.adam_agent.routing import ModelRouter, Route
from app.modules.adam_agent.spec import DatasetSpec
from app.modules.adam_agent.workflow import AdamAgent

router = APIRouter()

REVIEWER_ROLES = {"senior_developer", "admin"}

_agent: Optional[AdamAgent] = None
_audit: Optional[AuditLog] = None


def _safe_path(raw: str, must_be_dir: bool) -> Path:
    try:
        return safe_path(raw, must_be_dir=must_be_dir)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def get_audit() -> AuditLog:
    global _audit
    if _audit is None:
        _audit = AuditLog()
    return _audit


def _generator_and_router():
    """Pick the code generator: a live model (default) or an opt-in replay for demos.

    ``ADAM_AGENT_REPLAY_PROGRAMS`` (os.pathsep-separated R files, one per attempt)
    replays recorded programs instead of calling a model, so the workbench can be
    shown without an API key. Validation, the R run, the comparison and human
    review still run for real, and every result and audit record says
    ``provider: replay``.
    """
    replay = os.getenv("ADAM_AGENT_REPLAY_PROGRAMS", "").strip()
    if not replay:
        return LLMCodeGenerator(), ModelRouter.from_env(settings.DEFAULT_LLM_PROVIDER, settings.DEFAULT_MODEL)
    files = [Path(p) for p in replay.split(os.pathsep) if p.strip()]
    missing = [str(f) for f in files if not f.is_file()]
    if missing:
        raise HTTPException(503, f"Replay program not found: {', '.join(missing)}")
    logger.warning("ADaM agent is in REPLAY mode: no model is called ({} recorded program(s))", len(files))
    programs = [f.read_text(encoding="utf-8") for f in files]
    return ReplayGenerator(programs, model="recorded-program"), ModelRouter([Route("replay", "recorded-program")])


def get_agent() -> AdamAgent:
    global _agent
    if _agent is None:
        strict = os.getenv("ADAM_AGENT_REQUIRE_VERIFICATION", "true").lower() in {"1", "true", "yes"}
        mode = os.getenv("ADAM_AGENT_EXECUTOR", "docker")
        if mode not in {"docker", "local"}:
            raise HTTPException(503, "ADAM_AGENT_EXECUTOR must be docker or local")
        if strict and mode != "docker":
            raise HTTPException(503, "Strict API verification requires the Docker executor")
        executor = RExecutor(mode=mode)
        if not executor.available:
            raise HTTPException(503, "Configured R executor is unavailable; no verification was skipped")
        checkpoint_path = os.getenv("ADAM_AGENT_CHECKPOINT_PATH", "storage/adam_agent/checkpoints.sqlite")
        generator, agent_router = _generator_and_router()
        _agent = AdamAgent(
            generator=generator,
            validator=StaticValidator(),
            executor=executor,
            router=agent_router,
            audit=get_audit(),
            checkpointer=PersistentSqliteSaver(checkpoint_path),
            require_verification=strict,
        )
    return _agent


async def _start_checked(agent, *args, **kwargs):
    try:
        return await agent.start(*args, **kwargs)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


class StartRunRequest(BaseModel):
    spec: Optional[Dict[str, Any]] = Field(None, description="Spec as JSON (dataset, keys, sdtm_domains, variables)")
    spec_yaml: Optional[str] = Field(None, description="Spec as YAML text")
    sdtm_dir: str = Field(..., description="Folder with SDTM domain files (.csv or .xpt)")
    reference_path: Optional[str] = Field(None, description="Optional QC/reference dataset to compare against")
    max_attempts: int = Field(3, ge=1, le=6)
    match_threshold: float = Field(1.0, ge=0.0, le=1.0)
    variable_threshold: float = Field(1.0, ge=0.0, le=1.0)
    write_dataset_json: bool = False

    @model_validator(mode="after")
    def _one_spec(self) -> "StartRunRequest":
        if bool(self.spec) == bool(self.spec_yaml):
            raise ValueError("Provide exactly one of spec or spec_yaml")
        return self


class ReviewRequest(BaseModel):
    decision: Literal["approve", "reject"]
    comment: str = Field("", max_length=2000)


@router.post("/runs")
async def start_run(request: StartRunRequest, current_user: User = Depends(get_current_active_user)):
    try:
        spec = DatasetSpec.from_dict(request.spec) if request.spec else DatasetSpec.from_yaml_text(request.spec_yaml)
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid spec: {exc}")
    sdtm_dir = _safe_path(request.sdtm_dir, must_be_dir=True)
    reference = _safe_path(request.reference_path, must_be_dir=False) if request.reference_path else None
    result = await _start_checked(get_agent(),
        spec,
        sdtm_dir,
        reference,
        max_attempts=request.max_attempts,
        match_threshold=request.match_threshold,
        variable_threshold=request.variable_threshold,
        write_dataset_json=request.write_dataset_json,
        requested_by=current_user.username,
    )
    return result.to_dict()


@router.get("/runs/{run_id}")
async def get_run(run_id: str, current_user: User = Depends(get_current_active_user)):
    agent = get_agent()
    state = agent.get_state(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found in the checkpoint store")
    if state.get("awaiting_review"):
        state["review_packet"] = agent.review_packet(state)
    state.pop("sdtm_summary", None)
    return state


@router.post("/runs/{run_id}/review")
async def review_run(run_id: str, request: ReviewRequest, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in REVIEWER_ROLES:
        raise HTTPException(status_code=403, detail="Only senior developers or admins can sign off agent output")
    agent = get_agent()
    state = agent.get_state(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found")
    independent = os.getenv("ADAM_AGENT_REQUIRE_INDEPENDENT_REVIEW", "true").lower() in {"1", "true", "yes"}
    if independent and state.get("requested_by") == current_user.username:
        raise HTTPException(
            status_code=403, detail="Independent review required: the requester cannot approve their own run"
        )
    try:
        result = await agent.review(run_id, request.decision, reviewer=current_user.username, comment=request.comment)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return result.to_dict()


@router.get("/runs/{run_id}/audit")
async def run_audit(run_id: str, current_user: User = Depends(get_current_active_user)):
    return {"run_id": run_id, "records": get_audit().read(run_id)}


@router.get("/audit/verify")
async def verify_audit(current_user: User = Depends(get_current_active_user)):
    ok, problems = verify_chain(get_audit().path)
    return {"path": str(get_audit().path), "intact": ok, "problems": problems}
