"""Dataset specification model used by the ADaM agent.

A spec lists the target dataset, its key variables, the SDTM domains it reads and
one entry per variable with the derivation text a programmer would write. Specs
can be loaded from YAML (benchmark / CLI) or built from records (API / UI).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List


@dataclass(frozen=True)
class VariableSpec:
    """One target variable and how to derive it."""

    name: str
    label: str = ""
    type: str = "Char"  # Char | Num | Date | Datetime
    source: str = ""
    derivation: str = ""

    def __post_init__(self) -> None:
        if not self.name or not self.name.strip():
            raise ValueError("Variable name must not be empty")
        object.__setattr__(self, "name", self.name.strip().upper())


@dataclass
class DatasetSpec:
    """Specification of one ADaM dataset."""

    dataset: str
    variables: List[VariableSpec]
    label: str = ""
    keys: List[str] = field(default_factory=lambda: ["USUBJID"])
    sdtm_domains: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.dataset = self.dataset.strip().upper()
        self.keys = [k.strip().upper() for k in self.keys]
        self.sdtm_domains = [d.strip().lower() for d in self.sdtm_domains]
        if not self.variables:
            raise ValueError(f"Spec for {self.dataset} has no variables")
        names = [v.name for v in self.variables]
        dupes = sorted({n for n in names if names.count(n) > 1})
        if dupes:
            raise ValueError(f"Duplicate variables in spec: {dupes}")
        missing_keys = [k for k in self.keys if k not in names]
        if missing_keys:
            raise ValueError(f"Key variables not defined in spec: {missing_keys}")

    # ------------------------------------------------------------------ loaders
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DatasetSpec":
        variables = [
            v if isinstance(v, VariableSpec) else VariableSpec(**_known(v, VariableSpec))
            for v in data.get("variables", [])
        ]
        return cls(
            dataset=data["dataset"],
            label=data.get("label", ""),
            keys=list(data.get("keys", ["USUBJID"])),
            sdtm_domains=list(data.get("sdtm_domains", [])),
            variables=variables,
        )

    @classmethod
    def from_yaml(cls, path: str | Path) -> "DatasetSpec":
        import yaml

        with open(path, "r", encoding="utf-8") as handle:
            return cls.from_dict(yaml.safe_load(handle))

    @classmethod
    def from_yaml_text(cls, text: str) -> "DatasetSpec":
        import yaml

        return cls.from_dict(yaml.safe_load(text))

    # ----------------------------------------------------------------- helpers
    @property
    def variable_names(self) -> List[str]:
        return [v.name for v in self.variables]

    @property
    def output_object(self) -> str:
        """Name of the R data frame the generated program must create."""
        return self.dataset.lower()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dataset": self.dataset,
            "label": self.label,
            "keys": list(self.keys),
            "sdtm_domains": list(self.sdtm_domains),
            "variables": [asdict(v) for v in self.variables],
        }

    def to_prompt_block(self) -> str:
        lines = [f"Dataset: {self.dataset} ({self.label})", f"Keys: {', '.join(self.keys)}", "Variables:"]
        for v in self.variables:
            lines.append(f"- {v.name} [{v.type}] {v.label}. Source: {v.source or 'derived'}. {v.derivation}")
        return "\n".join(lines)


def _known(record: Dict[str, Any], klass: type) -> Dict[str, Any]:
    allowed = set(klass.__dataclass_fields__)  # type: ignore[attr-defined]
    return {k: v for k, v in record.items() if k in allowed}


def spec_from_records(dataset: str, records: Iterable[Dict[str, Any]], **kwargs: Any) -> DatasetSpec:
    """Build a spec from row dictionaries, e.g. parsed from the Excel spec upload."""
    return DatasetSpec(dataset=dataset, variables=[VariableSpec(**_known(r, VariableSpec)) for r in records], **kwargs)
