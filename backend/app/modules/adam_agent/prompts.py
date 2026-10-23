"""Prompt construction for generation and repair, plus code extraction."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, Optional

from .spec import DatasetSpec

ALLOWED_PACKAGES = ["dplyr", "tidyr", "stringr", "lubridate", "purrr", "tibble"]

CONTRACT = """Rules for the program:
- SDTM domains are already loaded as data frames named in lower case ({domains}); upper-case aliases also exist.
- These packages are already attached: {packages}. Do not call library(), require() or install.packages().
- Do not read or write files, change directories, call system commands or use eval()/parse().
- Create a data frame named `{output}` with one row per {keys} and every variable listed in the spec.
- Date variables must be R Date objects; numeric variables must be numeric; flags are character.
- Return only R code in a single ```r code block, with brief comments that name the derivation rule."""


def describe_sdtm_inputs(sdtm_dir: str | Path, domains: List[str], max_columns: int = 40) -> str:
    """Summarise available SDTM columns (with one example value) so the model uses real names."""
    import pandas as pd

    lines: List[str] = []
    files = domain_files(sdtm_dir, domains)
    for domain in domains:
        path = files.get(domain)
        if path is None:
            lines.append(f"{domain}: (not found)")
            continue
        if path.suffix == ".csv":
            frame = pd.read_csv(path, dtype=str, keep_default_na=False, nrows=50)
        else:
            frame = pd.read_sas(path, format="xport", encoding="utf-8").head(50)
        cols = []
        for col in list(frame.columns)[:max_columns]:
            sample = next((str(v) for v in frame[col] if str(v).strip() not in {"", "nan"}), "")
            cols.append(f"{col}={sample[:24]!r}" if sample else col)
        lines.append(f"{domain} ({len(frame.columns)} columns): " + ", ".join(cols))
    return "\n".join(lines)


def build_generation_prompt(spec: DatasetSpec, sdtm_summary: str, language: str = "R") -> str:
    if language.upper() != "R":
        raise ValueError("The agent pipeline currently generates R; SAS uses the existing generator")
    contract = CONTRACT.format(
        domains=", ".join(spec.sdtm_domains) or "see below",
        packages=", ".join(ALLOWED_PACKAGES),
        output=spec.output_object,
        keys=", ".join(spec.keys),
    )
    return (
        f"Write an R program that derives the CDISC ADaM dataset {spec.dataset}.\n\n"
        f"{spec.to_prompt_block()}\n\n"
        f"Available SDTM inputs:\n{sdtm_summary}\n\n{contract}"
    )


def build_repair_prompt(spec: DatasetSpec, sdtm_summary: str, previous_code: str, feedback: str, attempt: int) -> str:
    return (
        f"{build_generation_prompt(spec, sdtm_summary)}\n\n"
        f"Attempt {attempt - 1} produced the program below, but it failed checks.\n"
        f"```r\n{previous_code}\n```\n\n"
        f"Problems found:\n{feedback}\n\n"
        "Fix every problem listed. Keep correct derivations unchanged. Return the full corrected program."
    )


_FENCE = re.compile(r"```(?:r|R)?[ \t]*\n(.*?)```", re.DOTALL)


def extract_code(text: str) -> str:
    """Pull the R code out of a model response (largest fenced block, else the raw text)."""
    blocks = _FENCE.findall(text or "")
    if blocks:
        return max(blocks, key=len).strip()
    return (text or "").strip()


def truncate(text: Optional[str], limit: int = 1500) -> str:
    text = text or ""
    return text if len(text) <= limit else "..." + text[-limit:]


def domain_files(sdtm_dir: str | Path, domains: List[str]) -> Dict[str, Path]:
    base = Path(sdtm_dir)
    found: Dict[str, Path] = {}
    for domain in domains:
        for suffix in (".xpt", ".csv"):
            candidate = base / f"{domain}{suffix}"
            if candidate.exists():
                found[domain] = candidate
                break
    return found
