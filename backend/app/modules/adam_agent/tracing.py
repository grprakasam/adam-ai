"""Optional Langfuse tracing for agent runs.

Tracing is enabled only when ``LANGFUSE_PUBLIC_KEY`` and ``LANGFUSE_SECRET_KEY``
are set and the ``langfuse`` package is installed; otherwise every call is a
no-op. Tracing failures are logged and swallowed: observability must never
break code generation.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

from loguru import logger


class NoopTracer:
    enabled = False

    @contextmanager
    def span(self, name: str, **attributes: Any) -> Iterator[Dict[str, Any]]:
        yield {}

    def flush(self) -> None:  # pragma: no cover - trivial
        return None


class LangfuseTracer:
    """Thin adapter over the Langfuse SDK (v3 span API, with v2 fallback)."""

    enabled = True

    def __init__(self) -> None:
        import langfuse  # noqa: F401  (import check)

        try:
            from langfuse import get_client  # v3

            self._client = get_client()
            self._v3 = True
        except ImportError:  # v2
            from langfuse import Langfuse

            self._client = Langfuse()
            self._v3 = False

    @contextmanager
    def span(self, name: str, **attributes: Any) -> Iterator[Dict[str, Any]]:
        sink: Dict[str, Any] = {}
        handle = None
        try:
            if self._v3:
                handle = self._client.start_span(name=name, input=attributes)
            else:
                handle = self._client.trace(name=name, input=attributes)
        except Exception as exc:  # pragma: no cover - network/SDK issues
            logger.warning(f"Langfuse span start failed: {exc}")
        try:
            yield sink
        finally:
            if handle is not None:
                try:
                    if self._v3:
                        handle.update(output=sink)
                        handle.end()
                    else:
                        handle.update(output=sink)
                except Exception as exc:  # pragma: no cover
                    logger.warning(f"Langfuse span end failed: {exc}")

    def flush(self) -> None:
        try:
            self._client.flush()
        except Exception as exc:  # pragma: no cover
            logger.warning(f"Langfuse flush failed: {exc}")


_TRACER: Optional[Any] = None


def get_tracer() -> Any:
    """Return a Langfuse tracer when configured, else a no-op tracer."""
    global _TRACER
    if _TRACER is not None:
        return _TRACER
    if os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"):
        try:
            _TRACER = LangfuseTracer()
            logger.info("Langfuse tracing enabled for the ADaM agent")
            return _TRACER
        except Exception as exc:
            logger.warning(f"Langfuse configured but unavailable ({exc}); tracing disabled")
    _TRACER = NoopTracer()
    return _TRACER
