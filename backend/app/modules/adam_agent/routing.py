"""Model routing: start with a cheap model, escalate to a stronger one on repair.

Most derivations are simple copies or recodes that a small model handles; only
failed attempts need a larger model. Routing by attempt keeps the common path
cheap while preserving quality on hard cases.

Configure with ``ADAM_AGENT_ROUTES`` as comma-separated ``provider:model`` pairs,
cheapest first, e.g.::

    ADAM_AGENT_ROUTES="bedrock:anthropic.claude-haiku-5-5,bedrock:anthropic.claude-sonnet-5-5"
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class Route:
    provider: str
    model: Optional[str] = None

    def to_dict(self) -> Dict[str, Optional[str]]:
        return asdict(self)

    @classmethod
    def parse(cls, text: str) -> "Route":
        provider, _, model = text.strip().partition(":")
        if not provider:
            raise ValueError(f"Invalid route '{text}' (expected provider:model)")
        return cls(provider=provider.strip().lower(), model=model.strip() or None)


class ModelRouter:
    """Pick a route per attempt; escalate one tier every ``escalate_after`` attempts."""

    def __init__(self, routes: List[Route], escalate_after: int = 1) -> None:
        if not routes:
            raise ValueError("At least one route is required")
        if escalate_after < 1:
            raise ValueError("escalate_after must be >= 1")
        self.routes = routes
        self.escalate_after = escalate_after

    def route_for(self, attempt: int) -> Route:
        """``attempt`` is 1-based."""
        tier = min((max(attempt, 1) - 1) // self.escalate_after, len(self.routes) - 1)
        return self.routes[tier]

    @classmethod
    def parse(cls, text: str, escalate_after: int = 1) -> "ModelRouter":
        return cls([Route.parse(part) for part in text.split(",") if part.strip()], escalate_after)

    @classmethod
    def from_env(cls, default_provider: str = "google", default_model: Optional[str] = None) -> "ModelRouter":
        text = os.getenv("ADAM_AGENT_ROUTES", "").strip()
        escalate_after = int(os.getenv("ADAM_AGENT_ESCALATE_AFTER", "1"))
        if text:
            return cls.parse(text, escalate_after)
        return cls([Route(default_provider, default_model)], escalate_after)

    def describe(self) -> List[Dict[str, Optional[str]]]:
        return [r.to_dict() for r in self.routes]
