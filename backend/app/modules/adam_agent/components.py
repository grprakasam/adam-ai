"""Pluggable components used by the agent graph.

The graph only depends on the small protocols below, so each step can be swapped
(real LLM vs. replay, local R vs. Docker sandbox) and unit-tested with fakes.

* :class:`LLMCodeGenerator`  - calls the existing multi-provider LLM service
* :class:`ReplayGenerator`   - deterministic programs for CI / benchmark replay
* :class:`StaticValidator`   - deterministic checks before any code runs
* :class:`RExecutor`         - runs the program against SDTM inputs (local or Docker)
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import tempfile
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol, Sequence

from loguru import logger

from .prompts import ALLOWED_PACKAGES, domain_files, extract_code, truncate
from .routing import Route
from .spec import DatasetSpec

# --------------------------------------------------------------------------- generation


@dataclass
class GenerationResult:
    code: str
    raw_text: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    latency_s: float = 0.0


class CodeGenerator(Protocol):
    async def generate(self, prompt: str, *, route: Route, attempt: int) -> GenerationResult:
        ...


class LLMCodeGenerator:
    """Generates code through ``app.modules.llm_integration`` (OpenAI, Anthropic, Gemini, Bedrock...)."""

    def __init__(self, temperature: float = 0.1, max_tokens: int = 6000, service: Any = None) -> None:
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._service = service

    def _get_service(self) -> Any:
        if self._service is None:
            from app.modules.llm_integration.service import get_llm_service

            self._service = get_llm_service()
        return self._service

    async def generate(self, prompt: str, *, route: Route, attempt: int) -> GenerationResult:
        started = time.perf_counter()
        response = await self._get_service().generate(
            prompt=prompt,
            provider=route.provider,
            model=route.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )
        usage = response.get("usage", {}) or {}
        text = response.get("content", "") or ""
        return GenerationResult(
            code=extract_code(text),
            raw_text=text,
            provider=route.provider,
            model=response.get("model") or route.model or "unknown",
            prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
            completion_tokens=int(usage.get("completion_tokens", 0) or 0),
            cache_read_tokens=int(usage.get("cache_read_tokens", 0) or 0),
            cache_write_tokens=int(usage.get("cache_write_tokens", 0) or 0),
            latency_s=round(time.perf_counter() - started, 3),
        )


class ReplayGenerator:
    """Returns pre-written programs in order (the last one repeats). No tokens, no network."""

    def __init__(self, programs: Sequence[str], model: str = "replay") -> None:
        if not programs:
            raise ValueError("ReplayGenerator needs at least one program")
        self.programs = list(programs)
        self.model = model
        self.calls: List[str] = []

    async def generate(self, prompt: str, *, route: Route, attempt: int) -> GenerationResult:
        self.calls.append(prompt)
        code = self.programs[min(attempt, len(self.programs)) - 1]
        return GenerationResult(code=code, raw_text=code, provider="replay", model=self.model)


# --------------------------------------------------------------------------- validation


@dataclass
class ValidationReport:
    passed: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    checks: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def feedback(self) -> str:
        return "\n".join(f"- {e}" for e in self.errors) or "No static errors."


FORBIDDEN_CALLS = {
    r"\binstall\.packages\s*\(": "install.packages() is not allowed",
    r"\b(read\.csv|read_csv|read\.table|readRDS|read_xpt|read_sas|fread|readLines)\s*\(": "reading files is not allowed (inputs are pre-loaded)",
    r"\b(write\.csv|write_csv|write\.table|saveRDS|write_xpt|writeLines|sink)\s*\(": "writing files is not allowed (the runner saves the output)",
    r"\b(setwd|source|sys\.source|download\.file|url|file\.remove|unlink|file\.copy)\s*\(": "file-system / network calls are not allowed",
    r"\b(system|system2|shell|Sys\.setenv|Sys\.sleep)\s*\(": "system calls are not allowed",
    r"\b(eval|parse)\s*\(": "eval()/parse() are not allowed",
}


class StaticValidator:
    """Deterministic checks that run before any code executes."""

    def __init__(self, rscript: Optional[str] = None, check_syntax: bool = True) -> None:
        self.rscript = rscript or find_rscript()
        self.check_syntax = check_syntax

    async def validate(self, code: str, spec: DatasetSpec) -> ValidationReport:
        errors: List[str] = []
        warnings: List[str] = []
        checks: Dict[str, str] = {}

        if not code.strip():
            return ValidationReport(False, ["The model returned no code."], [], {"non_empty": "fail"})
        checks["non_empty"] = "pass"

        # 1. Safety patterns (shared with the consolidated-program validator). Calls are
        #    checked on code without comments or string contents, so text like
        #    "# don't use system()" does not count as a call.
        from app.modules.program_generation.validators import CodeValidator

        code_no_comments = _strip_r_comments(code)
        executable = _blank_strings(code_no_comments)
        safe, issues = CodeValidator.validate_code_safety(executable, "R")
        sandbox_issues = sorted({msg for pat, msg in FORBIDDEN_CALLS.items() if re.search(pat, executable)})
        for match in re.finditer(
            r"\b(library|require|requireNamespace)\s*\(\s*['\"]?([A-Za-z0-9.]+)", code_no_comments
        ):
            if match.group(2) not in ALLOWED_PACKAGES:
                sandbox_issues.append(f"package '{match.group(2)}' is not in the allowed list {ALLOWED_PACKAGES}")
        errors += [f"Safety: {i}" for i in (issues if not safe else [])] + [f"Sandbox: {i}" for i in sandbox_issues]
        checks["safety"] = "pass" if safe and not sandbox_issues else "fail"

        # 2. Output contract: the target data frame must be assigned
        target = spec.output_object
        if not re.search(rf"(^|\n)\s*{re.escape(target)}\s*(<-|=)", code_no_comments):
            errors.append(f"Contract: the program never assigns the output data frame `{target}`.")
            checks["output_assigned"] = "fail"
        else:
            checks["output_assigned"] = "pass"

        # 3. Every spec variable should appear somewhere in the code
        missing = [v for v in spec.variable_names if not re.search(rf"\b{v}\b", code_no_comments)]
        if missing:
            errors.append(f"Coverage: variables never mentioned in the code: {', '.join(missing)}.")
        checks["variable_coverage"] = "pass" if not missing else "fail"

        # 4. CDISC naming conventions (advisory)
        try:
            from app.modules.validation.adam_rules_validator import ADAMRulesValidator

            validator = ADAMRulesValidator()
            type_map = {"date": "numeric", "datetime": "numeric", "num": "numeric", "char": "character"}
            for var in spec.variables:
                for result in validator.validate_variable_naming(var.name, type_map.get(var.type.lower())):
                    warnings.append(f"CDISC naming: {result.message}")
        except Exception as exc:  # advisory only
            warnings.append(f"CDISC naming check skipped: {exc}")
        checks["cdisc_naming"] = "warn" if any(w.startswith("CDISC naming:") for w in warnings) else "pass"

        # 5. R syntax (parse only, nothing executes)
        if self.check_syntax and self.rscript:
            ok, message = await _r_parse_check(self.rscript, code)
            checks["r_syntax"] = "pass" if ok else "fail"
            if not ok:
                errors.append(f"Syntax: {message}")
        else:
            checks["r_syntax"] = "skipped"
            warnings.append("R syntax check skipped (Rscript not found)")

        return ValidationReport(passed=not errors, errors=errors, warnings=warnings, checks=checks)


def _strip_r_comments(code: str) -> str:
    out = []
    for line in code.splitlines():
        in_str: Optional[str] = None
        cut = len(line)
        for i, ch in enumerate(line):
            if in_str:
                if ch == in_str and line[i - 1] != "\\":
                    in_str = None
            elif ch in ("'", '"'):
                in_str = ch
            elif ch == "#":
                cut = i
                break
        out.append(line[:cut])
    return "\n".join(out)


def _blank_strings(code: str) -> str:
    """Replace the contents of R string literals with nothing (keeps the quotes)."""
    return re.sub(r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'', lambda m: m.group(0)[0] * 2, code)


async def _r_parse_check(rscript: str, code: str) -> tuple[bool, str]:
    with tempfile.TemporaryDirectory() as tmp:
        prog = Path(tmp) / "candidate.R"
        prog.write_text(code, encoding="utf-8")
        expr = f"invisible(parse(file = '{prog.as_posix()}'))"
        proc = await asyncio.create_subprocess_exec(
            rscript,
            "--vanilla",
            "-e",
            expr,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutError:
            proc.kill()
            return False, "R parse check timed out"
        if proc.returncode == 0:
            return True, ""
        return False, truncate(stderr.decode("utf-8", "replace").replace(prog.as_posix(), "program.R"), 600)


def find_rscript() -> Optional[str]:
    """Locate Rscript: RSCRIPT_PATH, PATH, R_HOME, then common Windows installs."""
    explicit = os.getenv("RSCRIPT_PATH")
    if explicit and Path(explicit).exists():
        return explicit
    found = shutil.which("Rscript")
    if found:
        return found
    r_home = os.getenv("R_HOME")
    if r_home:
        for candidate in (Path(r_home) / "bin" / "Rscript", Path(r_home) / "bin" / "Rscript.exe"):
            if candidate.exists():
                return str(candidate)
    for base in (Path("C:/Program Files/R"), Path("C:/Program Files (x86)/R")):
        if base.exists():
            versions = sorted(base.glob("R-*/bin/Rscript.exe"), reverse=True)
            if versions:
                return str(versions[0])
    return None


# --------------------------------------------------------------------------- execution


@dataclass
class ExecutionReport:
    success: bool
    exit_code: int
    duration_s: float
    output_path: Optional[str] = None
    rows: Optional[int] = None
    columns: Optional[List[str]] = None
    stdout_tail: str = ""
    stderr_tail: str = ""
    mode: str = "local"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def feedback(self) -> str:
        return f"The program failed when run (exit code {self.exit_code}). R error output:\n{self.stderr_tail or self.stdout_tail}"


RUNNER_TEMPLATE = r"""
options(warn = 1, stringsAsFactors = FALSE)
suppressPackageStartupMessages({{
{libraries}
}})
input_dir  <- "{input_dir}"
output_dir <- "{output_dir}"
for (f in list.files(input_dir, pattern = "\\.(csv|xpt)$", full.names = TRUE)) {{
  dom <- tolower(tools::file_path_sans_ext(basename(f)))
  df <- if (grepl("\\.xpt$", f)) haven::read_xpt(f) else utils::read.csv(f, colClasses = "character", na.strings = c("", "NA"))
  if (!grepl("\\.xpt$", f)) {{
    # CSV has no types: convert fully numeric columns, but keep identifiers
    # (names ending in ID) and zero-padded codes as character.
    for (col in names(df)) {{
      vals <- df[[col]]
      if (grepl("ID$", col) || any(grepl("^0[0-9]", vals[!is.na(vals)]))) next
      num <- suppressWarnings(as.numeric(vals))
      if (all(is.na(vals) == is.na(num))) df[[col]] <- num
    }}
  }}
  assign(dom, df, envir = .GlobalEnv)
  assign(toupper(dom), df, envir = .GlobalEnv)
}}
source("{program}", local = .GlobalEnv, echo = FALSE)
if (!exists("{target}") || !is.data.frame(get("{target}"))) stop("Program did not create a data frame named '{target}'")
out <- as.data.frame(get("{target}"))
for (col in names(out)) if (inherits(out[[col]], c("Date", "POSIXt"))) out[[col]] <- format(out[[col]], "%Y-%m-%d")
utils::write.csv(out, file.path(output_dir, "{target}.csv"), row.names = FALSE, na = "")
cat("ADAM_AGENT_ROWS=", nrow(out), "\n", sep = "")
"""


class RExecutor:
    """Runs a generated program against SDTM inputs.

    ``mode="local"`` uses the local Rscript. ``mode="docker"`` runs inside a
    container with networking disabled and a memory cap (sandboxed execution).
    """

    def __init__(
        self,
        mode: Optional[str] = None,
        timeout_s: int = 300,
        docker_image: Optional[str] = None,
        memory_mb: int = 2048,
        rscript: Optional[str] = None,
    ) -> None:
        self.mode = (mode or os.getenv("ADAM_AGENT_EXECUTOR", "local")).lower()
        self.timeout_s = timeout_s
        self.docker_image = docker_image or os.getenv("ADAM_AGENT_DOCKER_IMAGE", "rocker/tidyverse:4.4.2")
        self.memory_mb = memory_mb
        self.rscript = rscript or find_rscript()

    @property
    def available(self) -> bool:
        if self.mode == "docker":
            return shutil.which("docker") is not None
        return self.rscript is not None

    async def execute(
        self, code: str, spec: DatasetSpec, sdtm_dir: str | Path, work_dir: str | Path
    ) -> ExecutionReport:
        work = Path(work_dir)
        input_dir, output_dir = work / "input", work / "output"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        files = domain_files(sdtm_dir, spec.sdtm_domains)
        missing = [d for d in spec.sdtm_domains if d not in files]
        if missing:
            return ExecutionReport(
                False, -1, 0.0, stderr_tail=f"SDTM domains not found in {sdtm_dir}: {missing}", mode=self.mode
            )
        for path in files.values():
            shutil.copy2(path, input_dir / path.name)
        (work / "program.R").write_text(code, encoding="utf-8")

        in_container = self.mode == "docker"
        root = "/work" if in_container else work.as_posix()
        libs = ALLOWED_PACKAGES + (["haven"] if any(p.suffix == ".xpt" for p in files.values()) else [])
        runner = RUNNER_TEMPLATE.format(
            libraries="\n".join(f"  library({p})" for p in libs),
            input_dir=f"{root}/input",
            output_dir=f"{root}/output",
            program=f"{root}/program.R",
            target=spec.output_object,
        )
        (work / "runner.R").write_text(runner, encoding="utf-8")

        if in_container:
            cmd = [
                "docker",
                "run",
                "--rm",
                "--network",
                "none",
                f"--memory={self.memory_mb}m",
                "-v",
                f"{work.resolve()}:/work",
                self.docker_image,
                "Rscript",
                "--vanilla",
                "/work/runner.R",
            ]
        else:
            if not self.rscript:
                return ExecutionReport(
                    False, -1, 0.0, stderr_tail="Rscript not found; set RSCRIPT_PATH", mode=self.mode
                )
            cmd = [self.rscript, "--vanilla", str(work / "runner.R")]

        started = time.perf_counter()
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=self.timeout_s)
        except asyncio.TimeoutError:
            proc.kill()
            return ExecutionReport(
                False, -9, float(self.timeout_s), stderr_tail=f"Timed out after {self.timeout_s}s", mode=self.mode
            )
        duration = round(time.perf_counter() - started, 2)
        out_text = stdout.decode("utf-8", "replace")
        err_text = stderr.decode("utf-8", "replace")
        output_path = output_dir / f"{spec.output_object}.csv"
        success = proc.returncode == 0 and output_path.exists()
        rows = columns = None
        if success:
            import pandas as pd

            frame = pd.read_csv(output_path, dtype=str, keep_default_na=False)
            rows, columns = int(len(frame)), list(frame.columns)
        else:
            logger.info(f"Generated program failed (exit {proc.returncode})")
        return ExecutionReport(
            success=success,
            exit_code=int(proc.returncode if proc.returncode is not None else -1),
            duration_s=duration,
            output_path=str(output_path) if success else None,
            rows=rows,
            columns=columns,
            stdout_tail=truncate(out_text, 800),
            stderr_tail=truncate(err_text, 1500),
            mode=self.mode,
        )
