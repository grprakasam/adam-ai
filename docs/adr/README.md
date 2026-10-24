# Architecture decision records

Short records of significant design decisions for ADAM AI, in the
[MADR](https://adr.github.io/madr/) spirit: context, decision, consequences.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-langgraph-agent-orchestration.md) | Orchestrate generation as a LangGraph state machine | Accepted |
| [0002](0002-deterministic-gates-before-human-review.md) | Deterministic gates before any human review; exact-match QC bar | Accepted |
| [0003](0003-mandatory-independent-human-sign-off.md) | Mandatory, independent human sign-off; no API auto-approval | Accepted |
| [0004](0004-cheap-first-model-routing-and-cost-tracking.md) | Cheap-first model routing and per-run cost tracking | Accepted |
| [0005](0005-hash-chained-audit-log.md) | Hash-chained append-only audit log | Accepted |
| [0006](0006-public-benchmark-and-ci-quality-gate.md) | Public pharmaverse benchmark as a CI quality gate | Accepted |
| [0007](0007-mcp-server-for-deterministic-checks.md) | MCP server exposes checks only, in its own process | Accepted |
| [0008](0008-bedrock-provider-with-prompt-caching.md) | Amazon Bedrock provider with optional prompt caching | Accepted |
| [0009](0009-sandboxed-execution.md) | Static sandbox rules plus network-isolated execution | Accepted |
| [0010](0010-strict-verification-and-durable-review.md) | Strict verification by default; durable review checkpoints | Accepted |
