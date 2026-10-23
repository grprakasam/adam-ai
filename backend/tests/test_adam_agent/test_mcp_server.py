"""MCP server tools (needs the MCP SDK: pip install -r requirements-mcp.txt)."""

import asyncio

import pandas as pd
import pytest

pytest.importorskip("mcp")

from app.modules.adam_agent import mcp_server  # noqa: E402

SPEC_YAML = """
dataset: ADSL
keys: [USUBJID]
sdtm_domains: [dm]
variables:
  - {name: USUBJID}
  - {name: SAFFL}
"""


def test_tools_are_registered():
    tools = asyncio.run(mcp_server.server.list_tools())
    names = {t.name for t in tools}
    assert {"validate_adam_program", "compare_adam_datasets", "check_adam_variable_names", "verify_audit_log"} <= names
    assert not any("approve" in n for n in names)  # tools can check, never approve


def test_validate_tool_reports_sandbox_violations():
    report = asyncio.run(
        mcp_server.validate_adam_program(
            'adsl <- read.csv("x.csv")\nadsl$SAFFL <- "Y"\nadsl$USUBJID', SPEC_YAML, check_syntax=False
        )
    )
    assert report["passed"] is False and any("reading files" in e for e in report["errors"])


def test_compare_tool_respects_data_roots(tmp_path, monkeypatch):
    monkeypatch.setenv("ADAM_AGENT_DATA_ROOTS", str(tmp_path))
    pd.DataFrame([{"USUBJID": "1", "SAFFL": "Y"}]).to_csv(tmp_path / "gen.csv", index=False)
    pd.DataFrame([{"USUBJID": "1", "SAFFL": "N"}]).to_csv(tmp_path / "ref.csv", index=False)
    result = mcp_server.compare_adam_datasets(
        str(tmp_path / "gen.csv"), str(tmp_path / "ref.csv"), ["USUBJID"], ["SAFFL"]
    )
    assert result["overall_match_rate"] == 0.0 and "SAFFL" in result["feedback"]
    with pytest.raises(ValueError, match="outside the allowed"):
        mcp_server.compare_adam_datasets("/etc/passwd", str(tmp_path / "ref.csv"))


def test_naming_tool_flags_long_names():
    findings = mcp_server.check_adam_variable_names(["TRTSDT", "VERYLONGNAME"], ["numeric", "character"])
    assert any(f["rule_id"] == "ADAM-LEN" for f in findings)
