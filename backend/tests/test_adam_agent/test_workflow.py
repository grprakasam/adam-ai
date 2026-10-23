"""Graph behaviour with fake components (no LLM, no R needed)."""

from pathlib import Path

import pandas as pd
import pytest

from app.modules.adam_agent.audit import AuditLog, verify_chain
from app.modules.adam_agent.components import ExecutionReport, GenerationResult, ReplayGenerator, ValidationReport
from app.modules.adam_agent.routing import ModelRouter
from app.modules.adam_agent.workflow import AdamAgent

REF_ROWS = [{"USUBJID": "S1", "AGE": "63", "SAFFL": "Y"}, {"USUBJID": "S2", "AGE": "70", "SAFFL": "N"}]


class SequenceValidator:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)

    async def validate(self, code, spec):
        ok = self.outcomes.pop(0) if self.outcomes else True
        return ValidationReport(ok, [] if ok else ["Coverage: SAFFL never mentioned"], [], {})


class CsvExecutor:
    """Writes a pre-defined output per attempt instead of running R."""

    mode = "fake"

    def __init__(self, outputs):
        self.outputs = list(outputs)

    async def execute(self, code, spec, sdtm_dir, work_dir):
        rows = self.outputs.pop(0) if len(self.outputs) > 1 else self.outputs[0]
        if rows is None:
            return ExecutionReport(False, 1, 0.1, stderr_tail="Error: object 'ex' not found")
        out = Path(work_dir) / "output"
        out.mkdir(parents=True, exist_ok=True)
        path = out / "adsl.csv"
        pd.DataFrame(rows).to_csv(path, index=False)
        return ExecutionReport(True, 0, 0.1, output_path=str(path), rows=len(rows), mode="fake")


class FailingGenerator:
    async def generate(self, prompt, *, route, attempt):
        raise RuntimeError("all providers down")


@pytest.fixture
def data(tmp_path):
    sdtm = tmp_path / "sdtm"
    sdtm.mkdir()
    pd.DataFrame([{"USUBJID": "S1", "AGE": "63"}, {"USUBJID": "S2", "AGE": "70"}]).to_csv(sdtm / "dm.csv", index=False)
    ref = tmp_path / "ref.csv"
    pd.DataFrame(REF_ROWS).to_csv(ref, index=False)
    return sdtm, ref


def make_agent(tmp_path, generator, validator=None, executor=None):
    return AdamAgent(
        generator,
        validator or SequenceValidator([]),
        executor,
        router=ModelRouter.parse("fake:m1,fake:m2"),
        audit=AuditLog(tmp_path / "audit.jsonl"),
        work_root=tmp_path / "runs",
    )


@pytest.mark.asyncio
async def test_pauses_for_human_review_then_approves(tmp_path, data, small_spec):
    sdtm, ref = data
    agent = make_agent(tmp_path, ReplayGenerator(["adsl <- dm"]), executor=CsvExecutor([REF_ROWS]))
    result = await agent.start(small_spec, sdtm, ref)
    assert result.status == "awaiting_review"
    assert result.review_packet["evaluation"]["overall_match_rate"] == 1.0
    assert agent.get_state(result.run_id)["awaiting_review"] is True

    with pytest.raises(ValueError):
        await agent.review(result.run_id, "approve", reviewer="")  # named reviewer required

    final = await agent.review(result.run_id, "approve", reviewer="qc.lead", comment="Derivations checked")
    assert final.status == "approved"
    assert Path(final.state["final_program_path"]).read_text().startswith("# ADSL program generated")
    events = [r["event"] for r in AuditLog(tmp_path / "audit.jsonl").read(result.run_id)]
    assert events[0] == "run_started" and "human_review" in events and events[-1] == "run_finished"
    assert verify_chain(tmp_path / "audit.jsonl")[0]


@pytest.mark.asyncio
async def test_reject_decision_is_recorded(tmp_path, data, small_spec):
    sdtm, ref = data
    agent = make_agent(tmp_path, ReplayGenerator(["adsl <- dm"]), executor=CsvExecutor([REF_ROWS]))
    result = await agent.start(small_spec, sdtm, ref)
    final = await agent.review(result.run_id, "reject", reviewer="qc.lead", comment="Wrong population")
    assert final.status == "rejected" and "final_program_path" not in final.state
    with pytest.raises(ValueError, match="not waiting"):
        await agent.review(result.run_id, "approve", reviewer="qc.lead")


@pytest.mark.asyncio
async def test_validation_failure_triggers_repair_with_feedback(tmp_path, data, small_spec):
    sdtm, ref = data
    generator = ReplayGenerator(["adsl <- dm # v1", "adsl <- dm # v2"])
    agent = make_agent(tmp_path, generator, SequenceValidator([False, True]), CsvExecutor([REF_ROWS]))
    result = await agent.start(small_spec, sdtm, ref, auto_approve=True)
    assert result.status == "approved" and result.attempt == 2
    assert "Problems found" in generator.calls[1] and "SAFFL never mentioned" in generator.calls[1]
    assert result.state["route"]["model"] == "m2"  # escalated to the second tier


@pytest.mark.asyncio
async def test_execution_and_evaluation_failures_feed_back(tmp_path, data, small_spec):
    sdtm, ref = data
    wrong = [{"USUBJID": "S1", "AGE": "63", "SAFFL": "Y"}, {"USUBJID": "S2", "AGE": "70", "SAFFL": "Y"}]
    generator = ReplayGenerator(["v1", "v2", "v3"])
    agent = make_agent(tmp_path, generator, executor=CsvExecutor([None, wrong, REF_ROWS]))
    result = await agent.start(small_spec, sdtm, ref, auto_approve=True)
    assert result.attempt == 3 and result.status == "approved"
    assert "object 'ex' not found" in generator.calls[1]
    assert "SAFFL: 50.0% match" in generator.calls[2]


@pytest.mark.asyncio
async def test_attempt_cap_escalates_and_auto_mode_never_approves(tmp_path, data, small_spec):
    sdtm, ref = data
    agent = make_agent(tmp_path, ReplayGenerator(["v1"]), SequenceValidator([False, False]), CsvExecutor([REF_ROWS]))
    result = await agent.start(small_spec, sdtm, ref, max_attempts=2, auto_approve=True)
    assert result.state["escalated"] is True
    assert result.status == "rejected" and result.state["review"]["reviewer"] == "auto (benchmark/CI)"


@pytest.mark.asyncio
async def test_without_executor_goes_to_review_after_validation(tmp_path, data, small_spec):
    sdtm, ref = data
    agent = make_agent(tmp_path, ReplayGenerator(["adsl <- dm"]))
    result = await agent.start(small_spec, sdtm, ref)
    assert result.status == "awaiting_review" and result.review_packet["evaluation"] is None


@pytest.mark.asyncio
async def test_generation_failure_ends_run_cleanly(tmp_path, data, small_spec):
    sdtm, ref = data
    agent = make_agent(tmp_path, FailingGenerator())
    result = await agent.start(small_spec, sdtm, ref)
    assert result.status == "generation_failed" and "providers down" in result.state["error"]


@pytest.mark.asyncio
async def test_cost_is_tracked_per_run(tmp_path, data, small_spec):
    class PricedGenerator:
        async def generate(self, prompt, *, route, attempt):
            return GenerationResult(
                "adsl <- dm",
                "adsl <- dm",
                "bedrock",
                "anthropic.claude-haiku-5-5",
                prompt_tokens=2000,
                completion_tokens=500,
            )

    sdtm, ref = data
    agent = make_agent(tmp_path, PricedGenerator(), executor=CsvExecutor([REF_ROWS]))
    result = await agent.start(small_spec, sdtm, ref, auto_approve=True)
    cost = result.state["cost"]
    assert cost["prompt_tokens"] == 2000 and cost["completion_tokens"] == 500
    assert cost["usd"] == pytest.approx((2000 * 0.10 + 500 * 0.50) / 1_000_000)
