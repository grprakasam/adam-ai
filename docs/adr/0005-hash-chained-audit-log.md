# 0005 - Hash-chained append-only audit log

* Status: Accepted (2026-10-23)

## Context
Reviewers and auditors need to reconstruct who generated, checked and approved a
program, with which model and inputs, and to trust that the record was not edited.

## Decision
Write one JSON line per event (`run_started`, `generation`, `static_validation`,
`execution`, `evaluation`, `escalated`, `human_review`, `run_finished`). Each
record stores SHA-256 hashes of the prompt, response and code (not the text, so
logs do not leak spec content), the model version, tokens, cost, actor and UTC
timestamp, plus the previous record's hash and its own. `verify_chain()` detects
edits, deletions and reordering. Exposed via `/adam-agent/audit/verify` and MCP.

## Consequences
* Supports ALCOA+ (attributable, contemporaneous, original, accurate).
* It is tamper-evident, not tamper-proof: for production, ship the log to
  WORM/immutable storage. This alone does not make the system Part 11 validated.
