"""Write an ADaM dataset as CDISC Dataset-JSON (v1.1 structure).

The FDA has been evaluating Dataset-JSON as a successor to SAS V5 XPT for
submissions. This writer produces the v1.1 top-level structure (metadata,
``columns`` and ``rows``) from the agent's output so teams can trial it.
Validate files with CDISC tooling before using them in a submission.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from .spec import DatasetSpec

DATASET_JSON_VERSION = "1.1.0"
_TYPE_MAP = {"char": "string", "num": "double", "date": "date", "datetime": "datetime", "time": "time"}


def _cell(value: Any, data_type: str) -> Any:
    if value is None or (isinstance(value, float) and math.isnan(value)) or value == "":
        return None
    if data_type in {"double", "integer"}:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return int(number) if data_type == "integer" or number.is_integer() else number
    return str(value)


def to_dataset_json(
    frame: pd.DataFrame,
    spec: DatasetSpec,
    study_oid: str = "",
    originator: str = "ADAM AI",
    metadata_version_oid: str = "",
) -> Dict[str, Any]:
    variables = {v.name: v for v in spec.variables}
    frame = frame.copy()
    frame.columns = [str(c).upper() for c in frame.columns]
    ordered = [name for name in spec.variable_names if name in frame.columns]
    columns: List[Dict[str, Any]] = []
    for name in ordered:
        var = variables[name]
        data_type = _TYPE_MAP.get(var.type.lower(), "string")
        column: Dict[str, Any] = {
            "itemOID": f"IT.{spec.dataset}.{name}",
            "name": name,
            "label": var.label or name,
            "dataType": data_type,
        }
        if data_type == "string":
            lengths = frame[name].dropna().astype(str).str.len()
            column["length"] = int(lengths.max()) if len(lengths) else 1
        if name in spec.keys:
            column["keySequence"] = spec.keys.index(name) + 1
        columns.append(column)
    rows = [
        [_cell(record[name], col["dataType"]) for name, col in zip(ordered, columns)]
        for record in frame[ordered].to_dict("records")
    ]
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {
        "datasetJSONCreationDateTime": now,
        "datasetJSONVersion": DATASET_JSON_VERSION,
        "fileOID": f"ADAMAI.{spec.dataset}.{now}",
        "originator": originator,
        "sourceSystem": {"name": "ADAM AI", "version": "agent-v2"},
        "studyOID": study_oid or "UNKNOWN",
        "metaDataVersionOID": metadata_version_oid or "MDV.ADAMAI",
        "itemGroupOID": f"IG.{spec.dataset}",
        "records": len(rows),
        "name": spec.dataset,
        "label": spec.label or spec.dataset,
        "columns": columns,
        "rows": rows,
    }


def write_dataset_json(
    source_csv: str | Path, spec: DatasetSpec, target: str | Path, study_oid: Optional[str] = None
) -> Path:
    frame = pd.read_csv(source_csv, dtype=str, keep_default_na=False)
    if study_oid is None and "STUDYID" in frame.columns and len(frame):
        study_oid = str(frame["STUDYID"].iloc[0])
    payload = to_dataset_json(frame, spec, study_oid or "")
    target = Path(target)
    target.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    return target
