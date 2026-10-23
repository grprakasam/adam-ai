import json

import pytest

from app.modules.adam_agent.audit import AuditLog, sha256_text, verify_chain
from app.modules.adam_agent.cost import CostTracker, price_for
from app.modules.adam_agent.routing import ModelRouter, Route
from app.modules.adam_agent.spec import DatasetSpec


# ------------------------------------------------------------------ audit
def test_audit_chain_verifies_and_survives_reopen(tmp_path):
    path = tmp_path / "a.jsonl"
    log = AuditLog(path)
    log.append("run_started", "r1", dataset="ADSL")
    log.append("generation", "r1", code_sha256=sha256_text("x <- 1"))
    AuditLog(path).append("run_finished", "r1", status="approved")  # new instance continues the chain
    ok, problems = verify_chain(path)
    assert ok, problems
    records = AuditLog(path).read("r1")
    assert [r["seq"] for r in records] == [1, 2, 3]


def test_audit_detects_edits_and_deletions(tmp_path):
    path = tmp_path / "a.jsonl"
    log = AuditLog(path)
    for i in range(3):
        log.append("step", "r1", n=i)
    lines = path.read_text().splitlines()
    tampered = json.loads(lines[1])
    tampered["n"] = 99
    path.write_text("\n".join([lines[0], json.dumps(tampered), lines[2]]) + "\n")
    ok, problems = verify_chain(path)
    assert not ok and any("does not match its hash" in p for p in problems)

    path.write_text("\n".join([lines[0], lines[2]]) + "\n")  # deletion
    ok, problems = verify_chain(path)
    assert not ok and any("sequence" in p or "link" in p for p in problems)


# ------------------------------------------------------------------ cost
def test_price_lookup_handles_snapshots_and_bedrock_ids():
    assert price_for("claude-sonnet-5-5").input == 2.00
    assert price_for("anthropic.claude-haiku-5-5").output == 0.50
    assert price_for("claude-sonnet-4-5-20250929").input == 3.00
    assert price_for("some-unknown-model") is None


def test_cost_tracker_computes_usd_inr_and_cache_discount(monkeypatch):
    monkeypatch.setenv("ADAM_AGENT_USD_INR", "100")
    tracker = CostTracker()
    entry = tracker.record(
        step="generate",
        attempt=1,
        provider="bedrock",
        model="claude-sonnet-5-5",
        prompt_tokens=1_000_000,
        completion_tokens=100_000,
        cache_read_tokens=500_000,
    )
    # 500k uncached * $2 + 500k cached * $0.10 + 100k out * $10 (per 1M) = 1.0 + 0.05 + 1.0
    assert entry.usd == pytest.approx(2.05)
    assert entry.inr == pytest.approx(205.0)
    tracker.record(step="repair", attempt=2, provider="x", model="mystery", prompt_tokens=10, completion_tokens=5)
    totals = tracker.totals()
    assert totals["calls"] == 2 and totals["unpriced_models"] == ["mystery"]
    assert totals["usd"] == pytest.approx(2.05)


def test_zero_token_calls_cost_nothing():
    tracker = CostTracker()
    tracker.record(step="generate", attempt=1, provider="replay", model="replay", prompt_tokens=0, completion_tokens=0)
    assert tracker.totals()["usd"] == 0.0


# ------------------------------------------------------------------ routing
def test_router_escalates_per_attempt():
    router = ModelRouter.parse("bedrock:anthropic.claude-haiku-5-5, bedrock:anthropic.claude-sonnet-5-5")
    assert router.route_for(1) == Route("bedrock", "anthropic.claude-haiku-5-5")
    assert router.route_for(2).model == "anthropic.claude-sonnet-5-5"
    assert router.route_for(5).model == "anthropic.claude-sonnet-5-5"  # stays on the top tier
    slow = ModelRouter.parse("a:x,b:y", escalate_after=2)
    assert [slow.route_for(i).provider for i in (1, 2, 3)] == ["a", "a", "b"]


def test_router_from_env(monkeypatch):
    monkeypatch.setenv("ADAM_AGENT_ROUTES", "google:gemini-2.0-flash,anthropic:claude-sonnet-5-5")
    assert ModelRouter.from_env().route_for(2).provider == "anthropic"
    monkeypatch.delenv("ADAM_AGENT_ROUTES")
    assert ModelRouter.from_env("groq", "llama").route_for(1) == Route("groq", "llama")
    with pytest.raises(ValueError):
        Route.parse(":model")


# ------------------------------------------------------------------ spec
def test_spec_validation_rules():
    with pytest.raises(ValueError, match="Duplicate"):
        DatasetSpec.from_dict({"dataset": "adsl", "variables": [{"name": "USUBJID"}, {"name": "usubjid"}]})
    with pytest.raises(ValueError, match="Key variables"):
        DatasetSpec.from_dict({"dataset": "adsl", "keys": ["USUBJID"], "variables": [{"name": "AGE"}]})
