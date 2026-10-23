"""Variable-level comparison of a generated ADaM dataset against a reference.

This is the scoring engine for the benchmark and for the agent's evaluate step.
It behaves like a lightweight ``diffdf``: rows are aligned on the key
variables, values are normalised (missing values, numeric formatting, dates),
and every spec variable gets a match rate plus a few mismatch examples that the
repair prompt can quote back to the model.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd

MISSING_TOKENS = {"", "NA", "NAN", "NAT", "NONE", "NULL", "."}


@dataclass
class VariableResult:
    name: str
    compared: int
    matched: int
    match_rate: float
    status: str  # match | mismatch | missing_in_generated
    examples: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ComparisonReport:
    dataset: str
    keys: List[str]
    rows_reference: int
    rows_generated: int
    rows_matched_on_keys: int
    row_coverage: float
    overall_match_rate: float
    variables: List[VariableResult]
    missing_variables: List[str]
    duplicate_keys_generated: int = 0

    @property
    def fully_matched(self) -> List[str]:
        return [v.name for v in self.variables if v.status == "match"]

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["fully_matched_variables"] = len(self.fully_matched)
        data["total_variables"] = len(self.variables)
        return data

    def feedback(self, max_variables: int = 8) -> str:
        """Short, model-readable summary of what is wrong (used in repair prompts)."""
        lines = [
            f"Overall variable match {self.overall_match_rate:.1%}; "
            f"rows matched on keys {self.rows_matched_on_keys}/{self.rows_reference}."
        ]
        if self.duplicate_keys_generated:
            lines.append(f"{self.duplicate_keys_generated} duplicate key rows in the generated dataset.")
        if self.missing_variables:
            lines.append(f"Missing variables: {', '.join(self.missing_variables)}.")
        bad = sorted((v for v in self.variables if v.status == "mismatch"), key=lambda v: v.match_rate)[:max_variables]
        for v in bad:
            ex = "; ".join(f"{e['key']}: got {e['generated']!r}, expected {e['reference']!r}" for e in v.examples)
            lines.append(f"{v.name}: {v.match_rate:.1%} match. Examples: {ex}")
        return "\n".join(lines)


def normalise(value: Any) -> Optional[str]:
    """Normalise one value to a canonical string, or None when missing."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        if pd.isna(value):
            return None
        if value.hour == 0 and value.minute == 0 and value.second == 0:
            return value.strftime("%Y-%m-%d")
        return value.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if text.upper() in MISSING_TOKENS:
        return None
    try:
        number = float(text)
    except ValueError:
        return text
    if math.isnan(number):
        return None
    if math.isfinite(number) and number == int(number) and abs(number) < 1e15:
        return str(int(number))
    return repr(number)


def _missing(value: Any) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value))


def _equal(a: Optional[str], b: Optional[str], tolerance: float) -> bool:
    # pandas turns None into NaN during merges, so treat both as "missing"
    if _missing(a) or _missing(b):
        return _missing(a) and _missing(b)
    if a == b:
        return True
    try:
        return abs(float(a) - float(b)) <= tolerance
    except ValueError:
        return False


def load_table(path: str | Path) -> pd.DataFrame:
    """Load CSV, XPT, RDS-free formats as strings so nothing is silently coerced."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, dtype=str, keep_default_na=False)
    if suffix == ".xpt":
        return pd.read_sas(path, format="xport", encoding="utf-8")
    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    if suffix == ".json":
        return pd.read_json(path)
    raise ValueError(f"Unsupported dataset format: {path.name}")


def compare_datasets(
    generated: pd.DataFrame,
    reference: pd.DataFrame,
    keys: Iterable[str],
    variables: Optional[Iterable[str]] = None,
    dataset: str = "",
    tolerance: float = 1e-8,
    max_examples: int = 3,
) -> ComparisonReport:
    """Compare ``generated`` with ``reference`` variable by variable."""
    keys = [k.upper() for k in keys]
    gen = generated.copy()
    ref = reference.copy()
    gen.columns = [str(c).upper() for c in gen.columns]
    ref.columns = [str(c).upper() for c in ref.columns]

    for frame, label in ((gen, "generated"), (ref, "reference")):
        missing = [k for k in keys if k not in frame.columns]
        if missing:
            raise ValueError(f"Key variables {missing} not found in {label} dataset")

    # Key variables listed in the spec are scored by row coverage (see loop below).
    targets = [v.upper() for v in variables] if variables else [c for c in ref.columns if c not in keys]

    for frame in (gen, ref):
        for col in frame.columns:
            frame[col] = frame[col].map(normalise)

    dup_gen = int(gen.duplicated(subset=keys).sum())
    gen = gen.drop_duplicates(subset=keys, keep="first")
    ref = ref.drop_duplicates(subset=keys, keep="first")

    merged = ref.merge(gen, on=keys, how="left", suffixes=("__ref", "__gen"), indicator=True)
    matched_rows = int((merged["_merge"] == "both").sum())
    rows_reference = int(len(ref))

    results: List[VariableResult] = []
    missing_vars: List[str] = []
    for var in targets:
        if var in keys:
            results.append(
                VariableResult(
                    var,
                    rows_reference,
                    matched_rows,
                    matched_rows / rows_reference if rows_reference else 0.0,
                    "match" if matched_rows == rows_reference else "mismatch",
                )
            )
            continue
        if var not in ref.columns:
            continue  # not scoreable against this reference
        if var not in gen.columns:
            missing_vars.append(var)
            results.append(VariableResult(var, rows_reference, 0, 0.0, "missing_in_generated"))
            continue
        ref_col, gen_col = f"{var}__ref", f"{var}__gen"
        equal = [
            _equal(g, r, tolerance) if present else False
            for g, r, present in zip(merged[gen_col], merged[ref_col], merged["_merge"] == "both")
        ]
        n_match = int(sum(equal))
        examples = []
        for idx, ok in enumerate(equal):
            if not ok and len(examples) < max_examples:
                row = merged.iloc[idx]
                generated_value = row[gen_col] if row["_merge"] == "both" else "<row missing>"
                examples.append(
                    {
                        "key": "/".join(str(row[k]) for k in keys),
                        "generated": None if _missing(generated_value) else generated_value,
                        "reference": None if _missing(row[ref_col]) else row[ref_col],
                    }
                )
        rate = n_match / rows_reference if rows_reference else 0.0
        results.append(
            VariableResult(
                var, rows_reference, n_match, rate, "match" if n_match == rows_reference else "mismatch", examples
            )
        )

    overall = sum(r.match_rate for r in results) / len(results) if results else 0.0
    return ComparisonReport(
        dataset=dataset,
        keys=keys,
        rows_reference=rows_reference,
        rows_generated=int(len(generated)),
        rows_matched_on_keys=matched_rows,
        row_coverage=matched_rows / rows_reference if rows_reference else 0.0,
        overall_match_rate=overall,
        variables=results,
        missing_variables=missing_vars,
        duplicate_keys_generated=dup_gen,
    )


def compare_files(
    generated_path: str | Path,
    reference_path: str | Path,
    keys: Iterable[str],
    variables: Optional[Iterable[str]] = None,
    dataset: str = "",
) -> ComparisonReport:
    return compare_datasets(load_table(generated_path), load_table(reference_path), keys, variables, dataset)
