# Verification, persistence and portfolio evidence

The authenticated ADaM-agent API now defaults to strict verification:
Docker execution, an existing independent reference, exact overall and per-variable
agreement, and a human reviewer are required. Missing runtime returns 503;
missing reference/policy violations return 422. Failed checks cannot be
overridden with approval. The existing independent-review role check remains.
The offline Python API keeps an explicitly separate, permissive benchmark path.

Docker runs disable networking and use a read-only root filesystem, dropped
capabilities, no-new-privileges, process/memory limits and a writable temporary
directory. The run work directory remains writable. This reduces exposure but
does not establish a certified clinical computing environment.

Set these process environment variables before starting the API from the backend directory:

- ADAM_AGENT_EXECUTOR=docker (strict API default)
- ADAM_AGENT_REQUIRE_VERIFICATION=true (default)
- ADAM_AGENT_CHECKPOINT_PATH=storage/adam_agent/checkpoints.sqlite
- ADAM_AGENT_REQUIRE_INDEPENDENT_REVIEW=true (default)

The SQLite checkpointer supports paused-review recovery after reconstructing
the application with the same database, including the stored cost summary.
It is intended for a single host and one API worker. Back up checkpoint/audit
files and protect them with filesystem access controls. Multi-worker locking,
distributed persistence, in-flight crash recovery and operational durability
testing remain future work. The audit log remains separate from the checkpoint
database; it is not a transactional or regulated audit system.

The frontend now builds /agent.html. Sign in through the main application (the workbench uses the existing token), start a run, inspect gates/code/cost, reload by run ID,
and approve/reject with an independent authorized account. Server authorization
is authoritative. This is a review workbench, not a validated clinical release UI.

Document chunking now calls LangChain's RecursiveCharacterTextSplitter and
retains source offsets. Install backend/requirements-rag.txt to enable the real
sentence-transformers encoder. A missing encoder fails closed for nonempty
retrieval inputs. EMBEDDING_ALLOW_HASH_FALLBACK=true permits demo-only,
non-semantic hash vectors; rebuild any such index with the real encoder before
using retrieval results. Semantic retrieval quality has not been benchmarked.

The Azure chat-completions adapter is registered as azure_openai. Configure
AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT (HTTPS), AZURE_OPENAI_API_VERSION and
AZURE_OPENAI_DEPLOYMENT. Select a route with
ADAM_AGENT_ROUTES=azure_openai:YOUR_DEPLOYMENT_NAME. The deployment must support
chat completions, temperature and max_tokens. The version is explicit to match
the provisioned resource. Usage normalization and deployment routing are tested
with a mocked SDK. No Azure tenant/API request was made. Unknown model prices
remain unpriced; do not interpret that as free usage.

Validation evidence distinguishes unit tests, replay with known code/data,
mocked Azure calls, frontend build and actual live deployment. Live model
accuracy, production throughput, operational monitoring and time savings from
days to minutes remain unverified.

References:
- [Azure SDK client example](https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/articles/foundry-classic/openai/how-to/migration.md)
