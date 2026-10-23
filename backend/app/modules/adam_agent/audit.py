"""Append-only, hash-chained audit log for agent runs.

Each record captures who/what acted, when, on which inputs, and with what
result (prompt hash, model version, code hash, tokens, decision). Records are
chained: every record stores the SHA-256 of the previous record and its own
hash, so any edit or deletion breaks :func:`verify_chain`. This supports the
ALCOA+ expectations (attributable, contemporaneous, original, accurate) that
GxP reviewers apply to computerised systems; it is not by itself a validated
21 CFR Part 11 system.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

GENESIS = "0" * 64
DEFAULT_AUDIT_PATH = Path(__file__).resolve().parents[3] / "storage" / "audit" / "adam_agent_audit.jsonl"


def sha256_text(text: Optional[str]) -> Optional[str]:
    """SHA-256 of a text value (None stays None)."""
    if text is None:
        return None
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _record_hash(record: Dict[str, Any]) -> str:
    body = {k: v for k, v in record.items() if k != "hash"}
    payload = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AuditLog:
    """Thread-safe JSONL audit writer with hash chaining."""

    def __init__(self, path: Optional[str | Path] = None, actor: str = "adam-agent") -> None:
        self.path = Path(path or os.getenv("ADAM_AGENT_AUDIT_PATH") or DEFAULT_AUDIT_PATH)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.actor = actor
        self._lock = threading.Lock()
        self._last_hash, self._seq = self._tail()

    def _tail(self) -> Tuple[str, int]:
        if not self.path.exists() or self.path.stat().st_size == 0:
            return GENESIS, 0
        last_line = ""
        with open(self.path, "rb") as handle:
            for line in handle:
                if line.strip():
                    last_line = line.decode("utf-8")
        if not last_line:
            return GENESIS, 0
        record = json.loads(last_line)
        return record["hash"], int(record["seq"])

    def append(self, event: str, run_id: str, actor: Optional[str] = None, **fields: Any) -> Dict[str, Any]:
        """Write one record and return it (including its hash)."""
        with self._lock:
            record: Dict[str, Any] = {
                "seq": self._seq + 1,
                "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
                "run_id": run_id,
                "event": event,
                "actor": actor or self.actor,
                **fields,
                "prev_hash": self._last_hash,
            }
            record["hash"] = _record_hash(record)
            with open(self.path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, sort_keys=True, default=str) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
            self._last_hash, self._seq = record["hash"], record["seq"]
            return record

    def read(self, run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.path.exists():
            return []
        with open(self.path, "r", encoding="utf-8") as handle:
            records = [json.loads(line) for line in handle if line.strip()]
        return [r for r in records if run_id is None or r.get("run_id") == run_id]


def verify_chain(path: str | Path) -> Tuple[bool, List[str]]:
    """Check that no record was edited, removed or reordered."""
    path = Path(path)
    problems: List[str] = []
    if not path.exists():
        return True, problems
    previous, expected_seq = GENESIS, 1
    with open(path, "r", encoding="utf-8") as handle:
        for lineno, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                problems.append(f"line {lineno}: not valid JSON")
                continue
            if record.get("seq") != expected_seq:
                problems.append(f"line {lineno}: sequence {record.get('seq')} (expected {expected_seq})")
            if record.get("prev_hash") != previous:
                problems.append(f"line {lineno}: previous-hash link broken")
            if record.get("hash") != _record_hash(record):
                problems.append(f"line {lineno}: content does not match its hash")
            previous = record.get("hash", "")
            expected_seq = int(record.get("seq", expected_seq)) + 1
    return not problems, problems
