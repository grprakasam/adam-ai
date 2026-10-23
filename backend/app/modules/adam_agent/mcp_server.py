"""MCP server exposing ADAM AI's deterministic CDISC checks as tools.

Any MCP client (Claude Code, Claude Desktop, other agents) can call these tools to
check R programs and ADaM datasets. Generation and human sign-off stay inside the
ADAM AI app on purpose: tools can inspect and compare, but cannot approve code.

Run (stdio transport):
    cd backend && python -m app.modules.adam_agent.mcp_server

Example client config (Claude Code ``.mcp.json``):
    {"mcpServers": {"adam-ai-checks": {"command": "python",
      "args": ["-m", "app.modules.adam_agent.mcp_server"], "cwd": "backend"}}}
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

try:  # MCP Python SDK v2 renamed FastMCP to MCPServer
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # pragma: no cover - SDK v1
    from mcp.server.fastmcp import FastMCP as _Server

from .audit import AuditLog, verify_chain
from .compare import compare_files
from .components import StaticValidator
from .paths import safe_path
from .spec import DatasetSpec

server = _Server(
    "adam-ai-checks",
    instructions=(
        "Deterministic CDISC ADaM checks from ADAM AI. Use validate_adam_program before running "
        "generated R, compare_adam_datasets for QC against a reference dataset, and "
        "check_adam_variable_names for naming conventions. These tools never approve code."
    ),
)


async def validate_adam_program(code: str, spec_yaml: str, check_syntax: bool = True) -> Dict[str, Any]:
    """Run the static gates on an R program for an ADaM spec.

    Checks: sandbox safety (no file/system/eval calls, allowed packages only), the
    output data frame is assigned, every spec variable is referenced, CDISC naming
    (advisory) and R syntax (parse only, when R is installed).

    Args:
        code: The R program text.
        spec_yaml: The dataset spec as YAML (dataset, keys, sdtm_domains, variables).
        check_syntax: Parse the code with Rscript when available.
    """
    spec = DatasetSpec.from_yaml_text(spec_yaml)
    report = await StaticValidator(check_syntax=check_syntax).validate(code, spec)
    return report.to_dict()


def compare_adam_datasets(
    generated_path: str, reference_path: str, keys: Optional[List[str]] = None, variables: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Compare a generated ADaM dataset with a reference (QC) dataset, variable by variable.

    Rows are aligned on the key variables; missing values, number formatting and
    dates are normalised. Paths must be inside the allowed data folders.

    Args:
        generated_path: CSV or XPT produced by the program under test.
        reference_path: CSV or XPT reference dataset (e.g. double-programmed QC output).
        keys: Key variables, default ["USUBJID"].
        variables: Variables to score; default is every non-key reference variable.
    """
    report = compare_files(safe_path(generated_path), safe_path(reference_path), keys or ["USUBJID"], variables)
    data = report.to_dict()
    data["feedback"] = report.feedback()
    return data


def check_adam_variable_names(names: List[str], types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Check variable names against ADaM IG conventions (DT/DTM/FL/GRy/N suffixes, length).

    Args:
        names: Variable names, e.g. ["TRTSDT", "SAFFL", "AGEGR1"].
        types: Optional matching types ("numeric" or "character").
    """
    from app.modules.validation.adam_rules_validator import ADAMRulesValidator

    validator = ADAMRulesValidator()
    findings: List[Dict[str, Any]] = []
    for idx, name in enumerate(names):
        var_type = types[idx] if types and idx < len(types) else None
        for result in validator.validate_variable_naming(name.upper(), var_type):
            findings.append(result.model_dump() if hasattr(result, "model_dump") else result.dict())
        if len(name) > 8:
            findings.append(
                {
                    "rule_id": "ADAM-LEN",
                    "variable_name": name,
                    "severity": "error",
                    "message": f"{name}: ADaM variable names must be at most 8 characters",
                }
            )
    return findings


def verify_audit_log(path: Optional[str] = None) -> Dict[str, Any]:
    """Verify the hash chain of the ADaM agent audit log (detects edits or deletions).

    Args:
        path: Optional audit file; defaults to the configured agent audit log.
    """
    target = path or str(AuditLog().path)
    if path:
        target = str(safe_path(path))
    ok, problems = verify_chain(target)
    return {"path": target, "intact": ok, "problems": problems}


for _tool in (validate_adam_program, compare_adam_datasets, check_adam_variable_names, verify_audit_log):
    server.tool()(_tool)


def main() -> None:
    os.environ.setdefault("DISABLE_LLM_PROVIDERS", "1")  # the checks never call an LLM
    server.run("stdio")


if __name__ == "__main__":
    main()
