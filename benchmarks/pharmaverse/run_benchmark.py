"""ADAM AI public benchmark: pharmaversesdtm -> ADSL -> compare with pharmaverseadam.

Modes
-----
replay  Deterministic, no API key. Replays the golden program through the full agent
        graph (validate -> execute -> evaluate). With ``--replay-fault`` the first
        attempt is a deliberately wrong program, so the repair loop is exercised.
        This proves the harness and the quality gate work; it does not measure a model.
live    Generates the program with a real model (``--routes provider:model,...``).
        This is the number that measures ADAM AI itself.

Examples
--------
    python benchmarks/pharmaverse/run_benchmark.py --mode replay --replay-fault --min-match 1.0
    ADAM_AGENT_ROUTES="bedrock:anthropic.claude-haiku-5-5,bedrock:anthropic.claude-sonnet-5-5" \\
        python benchmarks/pharmaverse/run_benchmark.py --mode live --max-attempts 3

Exit code is 1 when the final match rate is below ``--min-match`` (CI quality gate).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DISABLE_LLM_PROVIDERS", "0")

from app.modules.adam_agent.audit import AuditLog, verify_chain  # noqa: E402
from app.modules.adam_agent.components import (  # noqa: E402
    LLMCodeGenerator,
    ReplayGenerator,
    RExecutor,
    StaticValidator,
)
from app.modules.adam_agent.routing import ModelRouter, Route  # noqa: E402
from app.modules.adam_agent.spec import DatasetSpec  # noqa: E402
from app.modules.adam_agent.workflow import AdamAgent  # noqa: E402

DEFAULT_SPEC = HERE / "specs" / "adsl_core.yaml"
DEFAULT_GOLDEN = HERE / "golden" / "adsl_core.R"
SDTM_DIR = HERE / "data" / "sdtm"
REFERENCE = HERE / "data" / "reference" / "adsl.csv"


def faulty_variant(program: str) -> str:
    """A realistic first-draft bug: off-by-one duration and the wrong age cut-off."""
    broken = program.replace("as.numeric(TRTEDT - TRTSDT) + 1", "as.numeric(TRTEDT - TRTSDT)")
    broken = broken.replace("AGE <= 64", "AGE < 64")
    if broken == program:
        raise RuntimeError("Golden program changed; update faulty_variant()")
    return broken


def build_agent(args: argparse.Namespace, audit: AuditLog, work_root: Path) -> AdamAgent:
    if args.mode == "replay":
        golden = Path(args.golden).read_text(encoding="utf-8")
        programs = [faulty_variant(golden), golden] if args.replay_fault else [golden]
        generator = ReplayGenerator(programs)
        router = ModelRouter([Route("replay", "golden-program")])
    else:
        os.environ["DISABLE_LLM_PROVIDERS"] = "0"
        generator = LLMCodeGenerator(temperature=0.0)
        router = ModelRouter.parse(args.routes) if args.routes else ModelRouter.from_env()
    executor = RExecutor(mode=args.executor, timeout_s=args.timeout)
    if not executor.available:
        raise SystemExit(f"No R runtime for executor mode '{args.executor}'. Install R or set RSCRIPT_PATH.")
    return AdamAgent(generator, StaticValidator(), executor, router=router, audit=audit, work_root=work_root)


def render_markdown(summary: dict) -> str:
    ev = summary.get("evaluation") or {}
    cost = summary.get("cost") or {}
    lines = [
        f"## ADAM AI benchmark ({summary['mode']})",
        "",
        f"- Dataset: **{summary['dataset']}** from pharmaversesdtm {summary['sources']['sdtm']} vs pharmaverseadam {summary['sources']['reference']}",
        f"- Routes: {', '.join((r['provider'] + ':' + (r['model'] or 'default')) for r in summary['routes'])}",
        f"- Final status: **{summary['status']}** after {summary['attempts']} attempt(s); first attempt passed all gates: {summary['first_attempt_passed']}",
        f"- Variable match: **{(ev.get('overall_match_rate') or 0):.1%}** ({ev.get('fully_matched_variables', 0)}/{ev.get('total_variables', 0)} variables exact), rows matched {ev.get('rows_matched_on_keys', 0)}/{ev.get('rows_reference', 0)}",
        f"- Repair loops: {summary['repair_loops']}; wall time {summary['wall_time_s']}s",
        f"- Tokens: {cost.get('prompt_tokens', 0)} in / {cost.get('completion_tokens', 0)} out; cost ${cost.get('usd') if cost.get('usd') is not None else 'n/a'} (Rs {cost.get('inr') if cost.get('inr') is not None else 'n/a'})",
        f"- Audit chain intact: {summary['audit_chain_intact']}",
    ]
    mismatched = [v for v in ev.get("variables", []) if v.get("status") != "match"]
    if mismatched:
        lines += ["", "| Variable | Match | Example |", "|---|---|---|"]
        for v in mismatched:
            ex = v["examples"][0] if v.get("examples") else {}
            lines.append(
                f"| {v['name']} | {v['match_rate']:.1%} | {ex.get('key', '')}: got {ex.get('generated')!r}, expected {ex.get('reference')!r} |"
            )
    if summary["mode"] == "replay":
        lines += [
            "",
            "_Replay mode validates the harness and quality gate with a known-good program; run `--mode live` to score a model._",
        ]
    return "\n".join(lines) + "\n"


async def run(args: argparse.Namespace) -> dict:
    spec = DatasetSpec.from_yaml(args.spec)
    manifest = json.loads((HERE / "data" / "manifest.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as tmp:
        audit = AuditLog(Path(tmp) / "audit.jsonl", actor="benchmark")
        agent = build_agent(args, audit, Path(tmp) / "runs")
        started = time.perf_counter()
        result = await agent.start(
            spec,
            SDTM_DIR,
            REFERENCE,
            max_attempts=args.max_attempts,
            match_threshold=args.match_threshold,
            variable_threshold=args.variable_threshold,
            auto_approve=True,
            requested_by="benchmark",
        )
        wall = round(time.perf_counter() - started, 2)
        chain_ok, _ = verify_chain(audit.path)
        state = result.state
        history = state.get("history", [])
        first_attempt = [h for h in history if h.get("attempt") == 1]
        first_passed = (
            bool(first_attempt)
            and all(
                h.get("outcome") in {"ok", "pass"}
                for h in first_attempt
                if h["step"] in {"generate", "validate", "execute", "evaluate"}
            )
            and any(h["step"] == "evaluate" and h["outcome"] == "pass" for h in first_attempt)
        )
        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "mode": args.mode,
            "dataset": spec.dataset,
            "sources": {k: manifest["sources"][k]["tag"] for k in ("sdtm", "reference")},
            "routes": agent.router.describe(),
            "status": result.status,
            "attempts": result.attempt,
            "repair_loops": max(result.attempt - 1, 0),
            "first_attempt_passed": first_passed,
            "evaluation": state.get("evaluation"),
            "validation": state.get("validation"),
            "execution": {k: (state.get("execution") or {}).get(k) for k in ("success", "rows", "duration_s", "mode")},
            "cost": state.get("cost"),
            "history": history,
            "wall_time_s": wall,
            "audit_chain_intact": chain_ok,
            "audit_records": len(audit.read()),
            "final_code": result.code,
        }
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ADAM AI pharmaverse benchmark")
    parser.add_argument("--mode", choices=["replay", "live"], default="replay")
    parser.add_argument("--spec", default=str(DEFAULT_SPEC))
    parser.add_argument("--golden", default=str(DEFAULT_GOLDEN))
    parser.add_argument("--replay-fault", action="store_true", help="first replay attempt is a faulty program")
    parser.add_argument("--routes", default="", help="provider:model,... cheapest first (live mode)")
    parser.add_argument("--executor", choices=["local", "docker"], default=os.getenv("ADAM_AGENT_EXECUTOR", "local"))
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument("--match-threshold", type=float, default=1.0)
    parser.add_argument("--variable-threshold", type=float, default=1.0)
    parser.add_argument("--min-match", type=float, default=0.0, help="fail (exit 1) below this final match rate")
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--out", default=str(HERE / "results"))
    args = parser.parse_args(argv)

    summary = asyncio.run(run(args))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    (out / f"{stamp}_{args.mode}.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    markdown = render_markdown(summary)
    (out / f"latest_{args.mode}.md").write_text(markdown, encoding="utf-8")
    print(markdown)
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
            handle.write(markdown)

    match = (summary.get("evaluation") or {}).get("overall_match_rate") or 0.0
    if match < args.min_match or not summary["audit_chain_intact"]:
        print(f"Quality gate failed: match {match:.3f} < {args.min_match} or audit chain broken", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
