"""Agentic ADaM generation pipeline (LangGraph).

generate -> validate -> execute -> evaluate, with a capped repair loop,
cheap-first model routing, a hash-chained audit log, cost tracking and a
human sign-off step. See docs/architecture/agentic-pipeline.md.

Import submodules directly (``from app.modules.adam_agent.workflow import AdamAgent``);
this package init stays light so the rest of the app does not need LangGraph
installed just to import the comparison or audit utilities.
"""

__all__ = [
    "audit",
    "compare",
    "components",
    "cost",
    "dataset_json",
    "prompts",
    "routing",
    "spec",
    "tracing",
    "workflow",
]
