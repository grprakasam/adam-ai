# 0001 - Orchestrate generation as a LangGraph state machine

* Status: Accepted (2026-10-23)

## Context
Generation used a linear call: build a prompt, call a model, return code. Real
programs fail in several ways (unsafe calls, R errors, wrong derivations), and each
failure needs a different next step. We also need to pause for a human decision
and resume later without re-running earlier steps.

## Decision
Model the pipeline as a LangGraph `StateGraph` with explicit nodes
(`generate`, `validate`, `execute`, `evaluate`, `escalate`, `human_review`,
`finalize`) and conditional edges. Use `interrupt()` plus a checkpointer for the
sign-off pause, and keep components behind small protocols so each can be faked
in tests.

## Consequences
* The control flow is visible and testable (see `tests/test_adam_agent/test_workflow.py`).
* Pausing and resuming for review is built in rather than hand-rolled.
* Adds a dependency (`langgraph`); the router is registered only if it imports,
  so the rest of the app is unaffected when it is missing.
* The default `InMemorySaver` loses paused runs on restart; production should
  switch to a persistent checkpointer (SQLite or Postgres saver).

## Alternatives considered
* Plain Python loop: simplest, but pause/resume and graph visibility would be custom code.
* CrewAI / AutoGen: oriented to multi-agent conversation; we need a deterministic
  workflow with a few model calls, not free-form agent chat.
