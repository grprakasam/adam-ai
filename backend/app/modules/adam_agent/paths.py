"""Allowed data folders for user- or tool-supplied paths (API and MCP server).

Paths are resolved and must sit inside one of the configured roots, which
blocks path traversal (``../../``) and reading arbitrary files on the server.
Configure with ``ADAM_AGENT_DATA_ROOTS`` (os.pathsep-separated).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

BACKEND_DIR = Path(__file__).resolve().parents[3]
REPO_DIR = BACKEND_DIR.parent


def data_roots() -> List[Path]:
    configured = os.getenv("ADAM_AGENT_DATA_ROOTS")
    if configured:
        return [Path(p).resolve() for p in configured.split(os.pathsep) if p.strip()]
    return [
        (BACKEND_DIR / "Content").resolve(),
        (REPO_DIR / "Content").resolve(),
        (REPO_DIR / "benchmarks" / "pharmaverse" / "data").resolve(),
    ]


def safe_path(raw: str, must_be_dir: bool = False) -> Path:
    """Resolve ``raw`` (absolute, or relative to the repo) and enforce the allowed roots.

    Raises:
        ValueError: if the path is outside the roots or does not exist.
    """
    if not raw or not str(raw).strip():
        raise ValueError("Path must not be empty")
    path = Path(raw)
    if not path.is_absolute():
        path = REPO_DIR / path
    path = path.resolve()
    if not any(path == root or root in path.parents for root in data_roots()):
        raise ValueError(f"Path is outside the allowed data folders: {raw}")
    if must_be_dir and not path.is_dir():
        raise ValueError(f"Folder not found: {raw}")
    if not must_be_dir and not path.is_file():
        raise ValueError(f"File not found: {raw}")
    return path
