# 0010 - Strict verification by default and durable review checkpoints

* Status: Accepted (2026-10-24)

## Context
The authenticated API could run permissively, and paused human reviews lived in
memory, so a restart lost them. Reviewers also needed a simple way to inspect a
run. Each capability's evidence should be stated plainly: unit-tested, replayed,
mocked or live.

## Decision

**Strict verification is the API default.** A run needs Docker execution, an
existing independent reference, exact overall and per-variable agreement, and a
human reviewer. A missing runtime returns 503; a missing reference or a policy
violation returns 422. Failed checks cannot be overridden by approval. The
existing independent-review role check remains. The offline Python API keeps a
separate, explicitly permissive benchmark path.

**Hardened execution.** Docker runs disable networking and use a read-only root
filesystem, dropped capabilities, no-new-privileges, process and memory limits
and a writable temporary directory. The run work directory remains writable.

**Durable review checkpoints.** A SQLite LangGraph checkpointer lets a paused
review resume after the application is rebuilt against the same database,
including the stored cost summary.

**Review workbench.** The frontend builds `/agent.html`. Sign in through the main
application (the workbench reuses its token), start a run, inspect gates, code
and cost, reload by run ID, and approve or reject with an independent authorized
account. Server-side authorization is authoritative.

**Retrieval.** Document chunking uses LangChain's `RecursiveCharacterTextSplitter`
and keeps source offsets. Install `backend/requirements-rag.txt` for the real
sentence-transformers encoder. A missing encoder fails closed for non-empty
retrieval inputs; `EMBEDDING_ALLOW_HASH_FALLBACK=true` permits demo-only,
non-semantic hash vectors.

**Azure OpenAI provider.** A chat-completions adapter is registered as
`azure_openai`. Configure `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` (HTTPS),
`AZURE_OPENAI_API_VERSION` and `AZURE_OPENAI_DEPLOYMENT`, and route with
`ADAM_AGENT_ROUTES=azure_openai:YOUR_DEPLOYMENT_NAME`. The deployment must support
chat completions, temperature and max_tokens; the API version is explicit to
match the provisioned resource.

Configuration (process environment, API started from `backend/`):

- `ADAM_AGENT_EXECUTOR=docker` (strict API default)
- `ADAM_AGENT_REQUIRE_VERIFICATION=true` (default)
- `ADAM_AGENT_CHECKPOINT_PATH=storage/adam_agent/checkpoints.sqlite`
- `ADAM_AGENT_REQUIRE_INDEPENDENT_REVIEW=true` (default)

## Consequences and limits
* The sandbox reduces exposure but does not establish a certified clinical
  computing environment.
* The SQLite checkpointer is for a single host and one API worker. Back up the
  checkpoint and audit files and protect them with filesystem access controls.
  Multi-worker locking, distributed persistence, in-flight crash recovery and
  operational durability testing remain future work.
* The audit log is separate from the checkpoint database. It is not a
  transactional or regulated audit system.
* The workbench is a review tool, not a validated clinical release UI.
* Semantic retrieval quality has not been benchmarked. Rebuild any index made
  with hash fallback vectors before using its results.
* Azure usage normalization and deployment routing are tested with a mocked SDK;
  no Azure tenant request was made. Unknown model prices remain unpriced, which
  does not mean free usage.
* Evidence is labelled by kind: unit tests, replay with known code and data,
  mocked provider calls, frontend build, live deployment. Live model accuracy,
  production throughput, operational monitoring and time savings remain
  unverified.

## References
* [Azure OpenAI client migration example](https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/articles/foundry-classic/openai/how-to/migration.md)
