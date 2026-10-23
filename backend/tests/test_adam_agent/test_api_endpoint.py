"""API rules: reviewer roles, independent review, path safety (agent uses fakes)."""

import importlib.util
import sys

import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.auth import User, get_current_active_user
from app.modules.adam_agent.audit import AuditLog
from app.modules.adam_agent.components import ReplayGenerator, ValidationReport
from app.modules.adam_agent.routing import ModelRouter
from app.modules.adam_agent.workflow import AdamAgent

from .conftest import BACKEND


def load_endpoint():
    """Load the endpoint module by path so the test does not import every other router."""
    path = BACKEND / "app" / "api" / "v1" / "endpoints" / "adam_agent.py"
    spec = importlib.util.spec_from_file_location("adam_agent_endpoint_under_test", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


SPEC = {
    "dataset": "ADSL",
    "keys": ["USUBJID"],
    "sdtm_domains": ["dm"],
    "variables": [{"name": "USUBJID"}, {"name": "AGE", "type": "Num"}],
}


class PassValidator:
    async def validate(self, code, spec):
        return ValidationReport(True, [], [], {})


@pytest.fixture
def client(tmp_path, monkeypatch):
    endpoint = load_endpoint()

    root = tmp_path / "data"
    (root / "sdtm").mkdir(parents=True)
    pd.DataFrame([{"USUBJID": "S1", "AGE": "63"}]).to_csv(root / "sdtm" / "dm.csv", index=False)
    monkeypatch.setenv("ADAM_AGENT_DATA_ROOTS", str(root))

    audit = AuditLog(tmp_path / "audit.jsonl")
    agent = AdamAgent(
        ReplayGenerator(["adsl <- dm"]),
        PassValidator(),
        None,
        router=ModelRouter.parse("fake:m"),
        audit=audit,
        work_root=tmp_path / "runs",
    )
    monkeypatch.setattr(endpoint, "_agent", agent)
    monkeypatch.setattr(endpoint, "_audit", audit)

    app = FastAPI()
    app.include_router(endpoint.router, prefix="/adam-agent")
    users = {"current": User(username="dev1", role="senior_developer")}
    app.dependency_overrides[get_current_active_user] = lambda: users["current"]
    test_client = TestClient(app)
    test_client.users = users
    test_client.root = root
    return test_client


def start(client):
    response = client.post("/adam-agent/runs", json={"spec": SPEC, "sdtm_dir": str(client.root / "sdtm")})
    assert response.status_code == 200, response.text
    return response.json()


def test_start_returns_review_packet(client):
    body = start(client)
    assert body["status"] == "awaiting_review" and body["review_packet"]["code"] == "adsl <- dm"
    state = client.get(f"/adam-agent/runs/{body['run_id']}").json()
    assert state["awaiting_review"] is True and state["requested_by"] == "dev1"


def test_requester_cannot_approve_own_run(client):
    body = start(client)
    response = client.post(f"/adam-agent/runs/{body['run_id']}/review", json={"decision": "approve"})
    assert response.status_code == 403 and "Independent review" in response.json()["detail"]


def test_regular_user_cannot_sign_off(client):
    body = start(client)
    client.users["current"] = User(username="viewer", role="user")
    response = client.post(f"/adam-agent/runs/{body['run_id']}/review", json={"decision": "approve"})
    assert response.status_code == 403


def test_independent_reviewer_approves_and_audit_is_intact(client):
    body = start(client)
    client.users["current"] = User(username="qc.lead", role="admin")
    response = client.post(
        f"/adam-agent/runs/{body['run_id']}/review", json={"decision": "approve", "comment": "Checked"}
    )
    assert response.status_code == 200 and response.json()["status"] == "approved"
    assert response.json()["review"]["reviewer"] == "qc.lead"
    audit = client.get(f"/adam-agent/runs/{body['run_id']}/audit").json()["records"]
    assert any(r["event"] == "human_review" and r["actor"] == "qc.lead" for r in audit)
    assert client.get("/adam-agent/audit/verify").json()["intact"] is True


def test_paths_outside_data_roots_are_rejected(client, tmp_path):
    response = client.post("/adam-agent/runs", json={"spec": SPEC, "sdtm_dir": str(tmp_path / "data" / ".." / "..")})
    assert response.status_code == 400 and "outside the allowed" in response.json()["detail"]


def test_exactly_one_spec_form_required(client):
    response = client.post("/adam-agent/runs", json={"sdtm_dir": str(client.root / "sdtm")})
    assert response.status_code == 422
