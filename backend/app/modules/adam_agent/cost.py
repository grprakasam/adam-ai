"""Token and cost accounting per agent run.

Every model call is recorded with its token counts; cost is computed from
``pricing.yaml`` (USD per million tokens) and converted to INR with a
configurable rate, so a run can report "tokens and rupees per ADaM dataset".
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

PRICING_FILE = Path(__file__).with_name("pricing.yaml")
DEFAULT_USD_INR = 94.95  # mid-market rate on 2026-10-20; override with ADAM_AGENT_USD_INR


@dataclass(frozen=True)
class ModelPrice:
    input: float
    output: float
    cache_read: Optional[float] = None
    cache_write: Optional[float] = None


@lru_cache(maxsize=4)
def load_pricing(path: Optional[str] = None) -> Dict[str, Any]:
    import yaml

    target = Path(path or os.getenv("ADAM_AGENT_PRICING_FILE") or PRICING_FILE)
    with open(target, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    return {"models": data.get("models", {}), "aliases": data.get("aliases", {})}


def price_for(model: Optional[str], pricing: Optional[Dict[str, Any]] = None) -> Optional[ModelPrice]:
    """Find the price entry for ``model``, tolerating dated snapshots and Bedrock prefixes."""
    if not model:
        return None
    pricing = pricing or load_pricing()
    models, aliases = pricing["models"], pricing["aliases"]
    candidates = [model, aliases.get(model, "")]
    # e.g. "claude-sonnet-5-5-20261001" -> "claude-sonnet-5-5"; "us.anthropic.x" -> "anthropic.x"
    stripped = model.split(":")[0]
    candidates += [stripped, stripped.rsplit("-", 1)[0], stripped.split(".", 1)[-1]]
    for name in candidates:
        name = aliases.get(name, name)
        if name in models:
            entry = models[name]
            return ModelPrice(
                input=float(entry["input"]),
                output=float(entry["output"]),
                cache_read=_opt(entry.get("cache_read")),
                cache_write=_opt(entry.get("cache_write")),
            )
    return None


def _opt(value: Any) -> Optional[float]:
    return None if value is None else float(value)


def usd_to_inr_rate() -> float:
    try:
        return float(os.getenv("ADAM_AGENT_USD_INR", DEFAULT_USD_INR))
    except ValueError:
        return DEFAULT_USD_INR


@dataclass
class CostEntry:
    step: str
    attempt: int
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    usd: Optional[float] = None
    inr: Optional[float] = None


@dataclass
class CostTracker:
    """Accumulates token usage and cost for one run."""

    usd_inr: float = field(default_factory=usd_to_inr_rate)
    entries: List[CostEntry] = field(default_factory=list)

    def record(
        self,
        *,
        step: str,
        attempt: int,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        cache_read_tokens: int = 0,
        cache_write_tokens: int = 0,
    ) -> CostEntry:
        price = price_for(model)
        usd = None
        if prompt_tokens == 0 and completion_tokens == 0:
            usd = 0.0  # replay / cached responses cost nothing
        elif price is not None:
            uncached_input = max(prompt_tokens - cache_read_tokens - cache_write_tokens, 0)
            usd = (
                uncached_input * price.input
                + completion_tokens * price.output
                + cache_read_tokens * (price.cache_read if price.cache_read is not None else price.input)
                + cache_write_tokens * (price.cache_write if price.cache_write is not None else price.input)
            ) / 1_000_000
        entry = CostEntry(
            step=step,
            attempt=attempt,
            provider=provider,
            model=model,
            prompt_tokens=int(prompt_tokens),
            completion_tokens=int(completion_tokens),
            cache_read_tokens=int(cache_read_tokens),
            cache_write_tokens=int(cache_write_tokens),
            usd=None if usd is None else round(usd, 6),
            inr=None if usd is None else round(usd * self.usd_inr, 4),
        )
        self.entries.append(entry)
        return entry

    def totals(self) -> Dict[str, Any]:
        priced = [e for e in self.entries if e.usd is not None]
        unpriced = sorted({e.model for e in self.entries if e.usd is None})
        return {
            "calls": len(self.entries),
            "prompt_tokens": sum(e.prompt_tokens for e in self.entries),
            "completion_tokens": sum(e.completion_tokens for e in self.entries),
            "cache_read_tokens": sum(e.cache_read_tokens for e in self.entries),
            "usd": round(sum(e.usd for e in priced), 6) if priced else (0.0 if not self.entries else None),
            "inr": round(sum(e.inr for e in priced), 4) if priced else (0.0 if not self.entries else None),
            "usd_inr_rate": self.usd_inr,
            "unpriced_models": unpriced,
        }

    def to_list(self) -> List[Dict[str, Any]]:
        return [asdict(e) for e in self.entries]
