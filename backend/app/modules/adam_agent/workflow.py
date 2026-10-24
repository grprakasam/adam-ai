"""LangGraph workflow: generate -> validate -> execute -> evaluate -> human sign-off.

::

    START -> generate -> validate --fail--> generate (repair, capped) | escalate
                            |pass
                         execute --fail--> generate (repair, capped) | escalate
                            |ok
                         evaluate --below threshold--> generate (repair, capped) | escalate
                            |pass
                    human_review (interrupt; a person approves or rejects)
                            |
                         finalize -> END

Design points (see docs/adr):
* The model proposes, deterministic gates check, and a named human approves.
  Nothing is marked approved without a recorded reviewer and code hash.
* Each repair attempt feeds the concrete failure (static errors, R error output,
  variable mismatches) back into the prompt, with a hard cap on attempts.
* Routing starts on a cheap model and escalates on repair (see routing.py).
* Every step writes a hash-chained audit record with prompt/response/code hashes,
  model version, tokens and cost.
"""

from __future__ import annotations

import json
import operator
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Dict, List, Optional, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from loguru import logger

from .audit import AuditLog, sha256_text
from .compare import compare_files
from .components import CodeGenerator, RExecutor, StaticValidator
from .cost import CostTracker
from .prompts import build_generation_prompt, build_repair_prompt, describe_sdtm_inputs, truncate
from .routing import ModelRouter, Route
from .spec import DatasetSpec
from .tracing import get_tracer

DEFAULT_WORK_ROOT = Path(__file__).resolve().parents[3] / "Content" / "Generated" / "ADAM_AGENT"


class AgentState(TypedDict, total=False):
    run_id: str
    spec: Dict[str, Any]
    sdtm_dir: str
    reference_path: Optional[str]
    work_dir: str
    max_attempts: int
    match_threshold: float
    variable_threshold: float
    auto_approve: bool
    requested_by: str
    write_dataset_json: bool
    sdtm_summary: str
    attempt: int
    route: Dict[str, Any]
    code: str
    code_sha256: str
    prompt_sha256: str
    feedback: str
    validation: Dict[str, Any]
    execution: Dict[str, Any]
    evaluation: Dict[str, Any]
    history: Annotated[List[Dict[str, Any]], operator.add]
    escalated: bool
    status: str
    error: str
    review: Dict[str, Any]
    cost: Dict[str, Any]
    final_program_path: str
    dataset_json_path: str


@dataclass
class AgentRunResult:
    run_id: str
    status: str
    attempt: int
    code: str
    review_packet: Optional[Dict[str, Any]] = None
    state: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        keep = (
            "validation",
            "execution",
            "evaluation",
            "history",
            "cost",
            "review",
            "escalated",
            "final_program_path",
            "dataset_json_path",
            "route",
            "error",
            "code_sha256",
        )
        return {
            "run_id": self.run_id,
            "status": self.status,
            "attempt": self.attempt,
            "code": self.code,
            "review_packet": self.review_packet,
            **{k: self.state.get(k) for k in keep},
        }


class AdamAgent:
    """Agentic ADaM program generator with capped repair and human sign-off."""

    def __init__(
        self,
        generator: CodeGenerator,
        validator: Optional[StaticValidator] = None,
        executor: Optional[RExecutor] = None,
        router: Optional[ModelRouter] = None,
        audit: Optional[AuditLog] = None,
        tracer: Any = None,
        checkpointer: Any = None,
        work_root: Optional[str | Path] = None,
        require_verification: bool = False,
    ) -> None:
        self.require_verification = require_verification
        self.generator = generator
        self.validator = validator or StaticValidator()
        self.executor = executor
        self.router = router or ModelRouter([Route("google")])
        self.audit = audit or AuditLog()
        self.tracer = tracer or get_tracer()
        self.work_root = Path(work_root or DEFAULT_WORK_ROOT)
        self._costs: Dict[str, CostTracker] = {}
        self.graph = self._build(checkpointer or InMemorySaver())

    # ------------------------------------------------------------------ graph
    def _build(self, checkpointer: Any):
        graph = StateGraph(AgentState)
        graph.add_node("generate", self._generate)
        graph.add_node("validate", self._validate)
        graph.add_node("execute", self._execute)
        graph.add_node("evaluate", self._evaluate)
        graph.add_node("escalate", self._escalate)
        graph.add_node("human_review", self._human_review)
        graph.add_node("finalize", self._finalize)

        graph.add_edge(START, "generate")
        graph.add_conditional_edges("generate", self._after_generate, ["validate", "finalize"])
        graph.add_conditional_edges(
            "validate", self._after_validate, ["execute", "human_review", "generate", "escalate"]
        )
        graph.add_conditional_edges(
            "execute", self._after_execute, ["evaluate", "human_review", "generate", "escalate"]
        )
        graph.add_conditional_edges("evaluate", self._after_evaluate, ["human_review", "generate", "escalate"])
        graph.add_edge("escalate", "human_review")
        graph.add_edge("human_review", "finalize")
        graph.add_edge("finalize", END)
        return graph.compile(checkpointer=checkpointer)

    # ------------------------------------------------------------------ nodes
    async def _generate(self, state: AgentState) -> Dict[str, Any]:
        run_id = state["run_id"]
        spec = DatasetSpec.from_dict(state["spec"])
        attempt = state.get("attempt", 0) + 1
        route = self.router.route_for(attempt)
        summary = state.get("sdtm_summary") or describe_sdtm_inputs(state["sdtm_dir"], spec.sdtm_domains)
        if attempt == 1 or not state.get("feedback"):
            prompt = build_generation_prompt(spec, summary)
        else:
            prompt = build_repair_prompt(spec, summary, state.get("code", ""), state["feedback"], attempt)

        try:
            with self.tracer.span("adam_agent.generate", run_id=run_id, attempt=attempt, route=route.to_dict()) as span:
                result = await self.generator.generate(prompt, route=route, attempt=attempt)
                span.update(
                    {
                        "model": result.model,
                        "prompt_tokens": result.prompt_tokens,
                        "completion_tokens": result.completion_tokens,
                    }
                )
        except Exception as exc:  # provider outage, auth error, etc.
            logger.error(f"[{run_id}] generation failed: {exc}")
            self.audit.append("generation_failed", run_id, attempt=attempt, route=route.to_dict(), error=str(exc))
            return {
                "attempt": attempt,
                "status": "generation_failed",
                "error": str(exc),
                "history": [{"attempt": attempt, "step": "generate", "outcome": "error", "detail": str(exc)}],
            }

        cost = self._cost(run_id).record(
            step="generate" if attempt == 1 else "repair",
            attempt=attempt,
            provider=result.provider,
            model=result.model,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            cache_read_tokens=result.cache_read_tokens,
            cache_write_tokens=result.cache_write_tokens,
        )
        code_hash, prompt_hash = sha256_text(result.code), sha256_text(prompt)
        self.audit.append(
            "generation",
            run_id,
            attempt=attempt,
            provider=result.provider,
            model=result.model,
            prompt_sha256=prompt_hash,
            response_sha256=sha256_text(result.raw_text),
            code_sha256=code_hash,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            cache_read_tokens=result.cache_read_tokens,
            usd=cost.usd,
            inr=cost.inr,
            latency_s=result.latency_s,
        )
        return {
            "attempt": attempt,
            "route": route.to_dict(),
            "code": result.code,
            "code_sha256": code_hash,
            "prompt_sha256": prompt_hash,
            "sdtm_summary": summary,
            "feedback": "",
            "validation": {},
            "execution": {},
            "evaluation": {},
            "status": "generated",
            "cost": self._cost(run_id).totals(),
            "history": [
                {
                    "attempt": attempt,
                    "step": "generate",
                    "outcome": "ok",
                    "model": result.model,
                    "provider": result.provider,
                    "tokens": result.prompt_tokens + result.completion_tokens,
                }
            ],
        }

    async def _validate(self, state: AgentState) -> Dict[str, Any]:
        spec = DatasetSpec.from_dict(state["spec"])
        report = await self.validator.validate(state["code"], spec)
        self.audit.append(
            "static_validation",
            state["run_id"],
            attempt=state["attempt"],
            passed=report.passed,
            errors=report.errors,
            checks=report.checks,
            code_sha256=state["code_sha256"],
        )
        update: Dict[str, Any] = {
            "validation": report.to_dict(),
            "status": "validated" if report.passed else "validation_failed",
            "history": [
                {
                    "attempt": state["attempt"],
                    "step": "validate",
                    "outcome": "pass" if report.passed else "fail",
                    "detail": "; ".join(report.errors)[:500],
                }
            ],
        }
        if not report.passed:
            update["feedback"] = report.feedback()
        return update

    async def _execute(self, state: AgentState) -> Dict[str, Any]:
        spec = DatasetSpec.from_dict(state["spec"])
        work_dir = Path(state["work_dir"]) / f"attempt_{state['attempt']}"
        report = await self.executor.execute(state["code"], spec, state["sdtm_dir"], work_dir)
        self.audit.append(
            "execution",
            state["run_id"],
            attempt=state["attempt"],
            success=report.success,
            exit_code=report.exit_code,
            rows=report.rows,
            duration_s=report.duration_s,
            mode=report.mode,
            code_sha256=state["code_sha256"],
            stderr_sha256=sha256_text(report.stderr_tail),
        )
        update: Dict[str, Any] = {
            "execution": report.to_dict(),
            "status": "executed" if report.success else "execution_failed",
            "history": [
                {
                    "attempt": state["attempt"],
                    "step": "execute",
                    "outcome": "ok" if report.success else "fail",
                    "detail": f"rows={report.rows}" if report.success else truncate(report.stderr_tail, 300),
                }
            ],
        }
        if not report.success:
            update["feedback"] = report.feedback()
        return update

    async def _evaluate(self, state: AgentState) -> Dict[str, Any]:
        spec = DatasetSpec.from_dict(state["spec"])
        report = compare_files(
            state["execution"]["output_path"], state["reference_path"], spec.keys, spec.variable_names, spec.dataset
        )
        worst = min((v.match_rate for v in report.variables), default=0.0)
        # Like double-programming QC: the overall match AND every single variable must clear the bar.
        passed = report.overall_match_rate >= state["match_threshold"] and worst >= state.get(
            "variable_threshold", state["match_threshold"]
        )
        self.audit.append(
            "evaluation",
            state["run_id"],
            attempt=state["attempt"],
            overall_match_rate=round(report.overall_match_rate, 6),
            worst_variable_match=round(worst, 6),
            fully_matched=len(report.fully_matched),
            total_variables=len(report.variables),
            passed=passed,
            code_sha256=state["code_sha256"],
        )
        update: Dict[str, Any] = {
            "evaluation": report.to_dict(),
            "status": "evaluated" if passed else "evaluation_failed",
            "history": [
                {
                    "attempt": state["attempt"],
                    "step": "evaluate",
                    "outcome": "pass" if passed else "fail",
                    "detail": f"match={report.overall_match_rate:.3f}; worst variable={worst:.3f}",
                }
            ],
        }
        if not passed:
            update["feedback"] = report.feedback()
        return update

    async def _escalate(self, state: AgentState) -> Dict[str, Any]:
        self.audit.append(
            "escalated",
            state["run_id"],
            attempt=state.get("attempt"),
            reason=f"checks still failing after {state.get('attempt')} attempts",
            last_status=state.get("status"),
        )
        return {
            "escalated": True,
            "status": "needs_attention",
            "history": [{"attempt": state.get("attempt"), "step": "escalate", "outcome": "needs_attention"}],
        }

    async def _human_review(self, state: AgentState) -> Dict[str, Any]:
        if state.get("auto_approve"):
            # Unattended benchmark/CI runs: never "approve" code that failed its checks.
            approve = not state.get("escalated")
            decision = {
                "decision": "approve" if approve else "reject",
                "reviewer": "auto (benchmark/CI)",
                "comment": "Automatic decision for a non-production run",
            }
        else:
            decision = interrupt(self.review_packet(state))
        decision = _normalise_decision(decision)
        self.audit.append(
            "human_review",
            state["run_id"],
            actor=decision["reviewer"],
            decision=decision["decision"],
            comment=decision.get("comment", ""),
            code_sha256=state.get("code_sha256"),
            attempt=state.get("attempt"),
            escalated=bool(state.get("escalated")),
            meaning="Reviewer approves this program for use"
            if decision["decision"] == "approve"
            else "Reviewer rejects this program",
        )
        decision["ts"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return {
            "review": decision,
            "status": "approved" if decision["decision"] == "approve" else "rejected",
            "history": [
                {
                    "attempt": state.get("attempt"),
                    "step": "human_review",
                    "outcome": decision["decision"],
                    "reviewer": decision["reviewer"],
                }
            ],
        }

    async def _finalize(self, state: AgentState) -> Dict[str, Any]:
        run_id = state["run_id"]
        update: Dict[str, Any] = {"cost": state.get("cost") or self._cost(run_id).totals()}
        if state.get("status") == "approved":
            spec = DatasetSpec.from_dict(state["spec"])
            final_dir = Path(state["work_dir"]) / "final"
            final_dir.mkdir(parents=True, exist_ok=True)
            review = state.get("review", {})
            header = (
                f"# {spec.dataset} program generated by ADAM AI agent\n"
                f"# Run: {run_id} | attempt {state.get('attempt')} | model {state.get('route', {}).get('model') or state.get('route', {}).get('provider')}\n"
                f"# Approved by: {review.get('reviewer')} at {review.get('ts')}\n"
                f"# Code SHA-256: {state.get('code_sha256')}\n\n"
            )
            program_path = final_dir / f"{spec.output_object}.R"
            program_path.write_text(header + state["code"] + "\n", encoding="utf-8")
            update["final_program_path"] = str(program_path)
            output = (state.get("execution") or {}).get("output_path")
            if state.get("write_dataset_json") and output:
                from .dataset_json import write_dataset_json

                update["dataset_json_path"] = str(
                    write_dataset_json(output, spec, final_dir / f"{spec.output_object}.json")
                )
        self.audit.append(
            "run_finished",
            run_id,
            status=state.get("status"),
            attempt=state.get("attempt"),
            final_program_sha256=sha256_text(state.get("code")) if state.get("status") == "approved" else None,
            cost=update["cost"],
        )
        self.tracer.flush()
        return update

    # ------------------------------------------------------------------ routing
    @staticmethod
    def _after_generate(state: AgentState) -> str:
        return "finalize" if state.get("status") == "generation_failed" else "validate"

    def _retry_or_escalate(self, state: AgentState) -> str:
        return "generate" if state["attempt"] < state["max_attempts"] else "escalate"

    def _after_validate(self, state: AgentState) -> str:
        if not state["validation"]["passed"]:
            return self._retry_or_escalate(state)
        return "execute" if self.executor is not None else "human_review"

    def _after_execute(self, state: AgentState) -> str:
        if not state["execution"]["success"]:
            return self._retry_or_escalate(state)
        return "evaluate" if state.get("reference_path") else "human_review"

    def _after_evaluate(self, state: AgentState) -> str:
        return "human_review" if state["status"] == "evaluated" else self._retry_or_escalate(state)

    # ------------------------------------------------------------------ public API
    async def start(
        self,
        spec: DatasetSpec,
        sdtm_dir: str | Path,
        reference_path: Optional[str | Path] = None,
        *,
        run_id: Optional[str] = None,
        max_attempts: int = 3,
        match_threshold: float = 1.0,
        variable_threshold: float = 1.0,
        auto_approve: bool = False,
        write_dataset_json: bool = False,
        requested_by: Optional[str] = None,
    ) -> AgentRunResult:
        """Run until approval is needed (or the run ends).

        ``match_threshold`` (overall) and ``variable_threshold`` (every variable) only apply
        when a reference dataset is given; both default to an exact match, as in
        double-programming QC.
        """
        if self.require_verification:
            if self.executor is None:
                raise ValueError("Strict verification requires an executor")
            if not reference_path or not Path(reference_path).is_file():
                raise ValueError("Strict verification requires an existing reference dataset")
            if auto_approve:
                raise ValueError("Strict verification requires human review")
            if match_threshold != 1.0 or variable_threshold != 1.0:
                raise ValueError("Strict verification requires exact reference agreement")
        if max_attempts < 1:
            raise ValueError("max_attempts must be >= 1")
        run_id = run_id or f"agent_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
        work_dir = self.work_root / spec.dataset / run_id
        work_dir.mkdir(parents=True, exist_ok=True)
        self._costs[run_id] = CostTracker()
        self.audit.append(
            "run_started",
            run_id,
            actor=requested_by,
            dataset=spec.dataset,
            spec_sha256=sha256_text(json.dumps(spec.to_dict(), sort_keys=True)),
            sdtm_dir=str(sdtm_dir),
            reference=str(reference_path) if reference_path else None,
            routes=self.router.describe(),
            max_attempts=max_attempts,
            match_threshold=match_threshold,
            variable_threshold=variable_threshold,
            executor=getattr(self.executor, "mode", None),
            auto_approve=auto_approve,
        )
        initial: AgentState = {
            "run_id": run_id,
            "spec": spec.to_dict(),
            "sdtm_dir": str(sdtm_dir),
            "reference_path": str(reference_path) if reference_path else None,
            "work_dir": str(work_dir),
            "max_attempts": max_attempts,
            "match_threshold": match_threshold,
            "variable_threshold": variable_threshold,
            "auto_approve": auto_approve,
            "requested_by": requested_by or "unknown",
            "write_dataset_json": write_dataset_json,
            "attempt": 0,
            "history": [],
            "escalated": False,
            "status": "started",
        }
        output = await self.graph.ainvoke(initial, self._config(run_id, max_attempts))
        return self._result(run_id, output)

    async def review(self, run_id: str, decision: str, reviewer: str, comment: str = "") -> AgentRunResult:
        """Resume a run paused for human review with an approve/reject decision."""
        resume = _normalise_decision({"decision": decision, "reviewer": reviewer, "comment": comment})
        snapshot = self.graph.get_state(self._config(run_id))
        if not snapshot or "human_review" not in (snapshot.next or ()):
            raise ValueError(f"Run {run_id} is not waiting for review")
        if self.require_verification and resume["decision"] == "approve":
            values = snapshot.values
            if (values.get("escalated") or
                    not (values.get("validation") or {}).get("passed") or
                    not (values.get("execution") or {}).get("success") or
                    not any(h.get("step") == "evaluate" and h.get("outcome") == "pass"
                            for h in values.get("history", []))):
                raise ValueError("Cannot approve: required verification gates did not pass")
        max_attempts = snapshot.values.get("max_attempts", 3)
        output = await self.graph.ainvoke(Command(resume=resume), self._config(run_id, max_attempts))
        return self._result(run_id, output)

    def get_state(self, run_id: str) -> Optional[Dict[str, Any]]:
        snapshot = self.graph.get_state(self._config(run_id))
        if not snapshot or not snapshot.values:
            return None
        values = dict(snapshot.values)
        values["awaiting_review"] = "human_review" in (snapshot.next or ())
        return values

    def review_packet(self, state: Dict[str, Any]) -> Dict[str, Any]:
        evaluation = state.get("evaluation") or {}
        return {
            "run_id": state.get("run_id"),
            "dataset": (state.get("spec") or {}).get("dataset"),
            "attempt": state.get("attempt"),
            "escalated": bool(state.get("escalated")),
            "code": state.get("code"),
            "code_sha256": state.get("code_sha256"),
            "validation": state.get("validation"),
            "execution": {k: (state.get("execution") or {}).get(k) for k in ("success", "rows", "duration_s")},
            "evaluation": {
                "overall_match_rate": evaluation.get("overall_match_rate"),
                "fully_matched_variables": evaluation.get("fully_matched_variables"),
                "total_variables": evaluation.get("total_variables"),
                "mismatched": [v["name"] for v in evaluation.get("variables", []) if v.get("status") != "match"],
            }
            if evaluation
            else None,
            "cost": state.get("cost"),
            "question": "Approve this program for use? Reply with decision=approve|reject, reviewer and comment.",
        }

    # ------------------------------------------------------------------ helpers
    def _cost(self, run_id: str) -> CostTracker:
        return self._costs.setdefault(run_id, CostTracker())

    @staticmethod
    def _config(run_id: str, max_attempts: int = 3) -> Dict[str, Any]:
        return {"configurable": {"thread_id": run_id}, "recursion_limit": 12 + 6 * max_attempts}

    def _result(self, run_id: str, output: Dict[str, Any]) -> AgentRunResult:
        interrupts = output.get("__interrupt__") or []
        if interrupts:
            return AgentRunResult(
                run_id,
                "awaiting_review",
                output.get("attempt", 0),
                output.get("code", ""),
                review_packet=interrupts[0].value,
                state=output,
            )
        return AgentRunResult(
            run_id, output.get("status", "unknown"), output.get("attempt", 0), output.get("code", ""), state=output
        )


def _normalise_decision(decision: Any) -> Dict[str, Any]:
    if not isinstance(decision, dict):
        raise ValueError("Review decision must be a mapping with decision and reviewer")
    choice = str(decision.get("decision", "")).strip().lower()
    reviewer = str(decision.get("reviewer", "")).strip()
    if choice not in {"approve", "reject"}:
        raise ValueError("decision must be 'approve' or 'reject'")
    if not reviewer:
        raise ValueError("A named reviewer is required for sign-off")
    return {"decision": choice, "reviewer": reviewer, "comment": str(decision.get("comment", ""))}
