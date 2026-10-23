"""Fetch the public pharmaverse benchmark data and convert it to CSV.

Inputs (SDTM) come from ``pharmaversesdtm`` and the reference ADaM datasets from
``pharmaverseadam``. Both are Apache-2.0 licensed test data built from the public
CDISC pilot study, so no client data is involved. Each source is pinned to a
released tag so benchmark numbers are reproducible.

Usage:
    python benchmarks/pharmaverse/fetch_data.py            # fetch + convert
    python benchmarks/pharmaverse/fetch_data.py --verify   # check checksums only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
MANIFEST = DATA_DIR / "manifest.json"

SOURCES = {
    "sdtm": {
        "repo": "pharmaverse/pharmaversesdtm",
        "tag": "v1.5.0",
        "datasets": ["dm", "ex", "ds"],
    },
    "reference": {
        "repo": "pharmaverse/pharmaverseadam",
        "tag": "v1.4.0",
        "datasets": ["adsl"],
    },
}

RAW_URL = "https://raw.githubusercontent.com/{repo}/{tag}/data/{name}.rda"


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _rda_to_frame(rda_path: Path, name: str):
    """Read one data frame from an .rda file with pyreadr (no R needed)."""
    import warnings

    import pandas as pd
    import pyreadr

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # pyreadr warns on missing dates
        result = pyreadr.read_r(str(rda_path))
    frame = result.get(name)
    if frame is None:
        frame = next(iter(result.values()))
    # Normalise dates/datetimes to ISO strings so CSVs are stable across platforms.
    for col in frame.columns:
        if pd.api.types.is_datetime64_any_dtype(frame[col]):
            values = frame[col]
            has_time = (values.dropna().dt.normalize() != values.dropna()).any()
            fmt = "%Y-%m-%dT%H:%M:%S" if has_time else "%Y-%m-%d"
            frame[col] = values.dt.strftime(fmt)
    return frame


def fetch() -> dict:
    manifest: dict = {"sources": {}, "files": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for group, src in SOURCES.items():
            manifest["sources"][group] = {"repo": src["repo"], "tag": src["tag"]}
            out_dir = DATA_DIR / group
            out_dir.mkdir(parents=True, exist_ok=True)
            for name in src["datasets"]:
                url = RAW_URL.format(repo=src["repo"], tag=src["tag"], name=name)
                rda = Path(tmp) / f"{group}_{name}.rda"
                print(f"Downloading {url}")
                urllib.request.urlretrieve(url, rda)  # noqa: S310 - fixed https URL
                frame = _rda_to_frame(rda, name)
                csv_path = out_dir / f"{name}.csv"
                frame.to_csv(csv_path, index=False)
                rel = csv_path.relative_to(DATA_DIR).as_posix()
                manifest["files"][rel] = {
                    "source_url": url,
                    "source_sha256": _sha256(rda),
                    "csv_sha256": _sha256(csv_path),
                    "rows": int(frame.shape[0]),
                    "columns": int(frame.shape[1]),
                }
                print(f"  -> {rel}: {frame.shape[0]} rows x {frame.shape[1]} columns")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def verify() -> bool:
    if not MANIFEST.exists():
        print("manifest.json missing - run without --verify first")
        return False
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    ok = True
    for rel, meta in manifest["files"].items():
        path = DATA_DIR / rel
        if not path.exists():
            print(f"MISSING {rel}")
            ok = False
        elif _sha256(path) != meta["csv_sha256"]:
            print(f"CHANGED {rel}")
            ok = False
    print("Benchmark data verified" if ok else "Benchmark data does not match manifest")
    return ok


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="only verify checksums")
    args = parser.parse_args(argv)
    if args.verify:
        return 0 if verify() else 1
    fetch()
    return 0


if __name__ == "__main__":
    sys.exit(main())
