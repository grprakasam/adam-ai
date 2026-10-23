# 0007 - MCP server exposes checks only, in its own process

* Status: Accepted (2026-10-23)

## Context
Other agents (Claude Code, IDE assistants) benefit from calling our CDISC checks
directly. The MCP SDK needs newer httpx/starlette than the pinned FastAPI app.

## Decision
`app/modules/adam_agent/mcp_server.py` exposes `validate_adam_program`,
`compare_adam_datasets`, `check_adam_variable_names` and `verify_audit_log`.
There is no generate-and-approve tool: tools can check and compare, never sign
off. File paths are restricted to the allowed data folders. The server runs as a
separate process with `requirements-mcp.txt` (supports MCP SDK v1 and v2).

## Consequences
* Any MCP client can reuse the same gates the agent uses.
* Two environments to maintain (app and MCP server).
