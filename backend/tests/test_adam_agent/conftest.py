"""Shared fixtures for the agentic ADaM pipeline tests."""

import os
import shutil
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
BENCH = REPO / "benchmarks" / "pharmaverse"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DISABLE_LLM_PROVIDERS", "1")


@pytest.fixture(autouse=True)
def _isolated_audit(tmp_path, monkeypatch):
    monkeypatch.setenv("ADAM_AGENT_AUDIT_PATH", str(tmp_path / "audit.jsonl"))
    yield


@pytest.fixture
def bench_spec():
    from app.modules.adam_agent.spec import DatasetSpec

    return DatasetSpec.from_yaml(BENCH / "specs" / "adsl_core.yaml")


@pytest.fixture
def golden_program():
    return (BENCH / "golden" / "adsl_core.R").read_text(encoding="utf-8")


@pytest.fixture
def small_spec():
    from app.modules.adam_agent.spec import DatasetSpec

    return DatasetSpec.from_dict(
        {
            "dataset": "ADSL",
            "keys": ["USUBJID"],
            "sdtm_domains": ["dm"],
            "variables": [
                {"name": "USUBJID", "type": "Char", "derivation": "Copy DM.USUBJID"},
                {"name": "AGE", "type": "Num", "derivation": "Copy DM.AGE"},
                {"name": "SAFFL", "type": "Char", "derivation": "Y if exposed"},
            ],
        }
    )


def rscript_path():
    from app.modules.adam_agent.components import find_rscript

    return find_rscript()


requires_r = pytest.mark.skipif(
    rscript_path() is None and shutil.which("Rscript") is None, reason="R (Rscript) not installed"
)
