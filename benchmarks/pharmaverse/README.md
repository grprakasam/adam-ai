# Pharmaverse benchmark for ADAM AI

A public, reproducible benchmark: generate **ADSL** from `pharmaversesdtm` SDTM
data and compare it, variable by variable, with the `pharmaverseadam` reference
ADSL. Both packages are Apache-2.0 test data built from the CDISC pilot study, so
no client data is involved.

| Item | Value |
|---|---|
| Inputs | `pharmaversesdtm` **v1.5.0**: DM (306), EX (591), DS (850 rows) |
| Reference | `pharmaverseadam` **v1.4.0** ADSL (306 subjects) |
| Spec | `specs/adsl_core.yaml` - 28 variables (copies, recodes, treatment dates, duration, SAFFL, EOSSTT, RANDDT, death date) |
| Golden program | `golden/adsl_core.R` - reproduces all 28 variables for all 306 subjects |
| Comparison | key-aligned (USUBJID), normalised missing values / numbers / dates (`backend/app/modules/adam_agent/compare.py`) |

## Run

```bash
pip install -r backend/requirements-agent.txt      # plus R with dplyr, tidyr, stringr, lubridate, purrr, tibble

# Replay: no API key. Proves the harness, gates and repair loop (first attempt is deliberately wrong).
python benchmarks/pharmaverse/run_benchmark.py --mode replay --replay-fault --min-match 1.0

# Live: score a real model. Cheapest route first; the agent escalates on repair.
ADAM_AGENT_ROUTES="anthropic:claude-haiku-5-5,anthropic:claude-sonnet-5-5" \
  python benchmarks/pharmaverse/run_benchmark.py --mode live --max-attempts 3

# Refresh or verify the pinned data
python benchmarks/pharmaverse/fetch_data.py            # needs pyreadr
python benchmarks/pharmaverse/fetch_data.py --verify
```

Windows: set `RSCRIPT_PATH` if Rscript is not on PATH, e.g.
`set RSCRIPT_PATH=C:\Program Files\R\R-4.4.2\bin\Rscript.exe`.

## Metrics reported

* **First attempt passed** - generated code passed every gate and matched on attempt 1
* **Variable match** - mean per-variable match rate, and variables matching exactly
* **Rows matched on keys** - reference subjects present in the output
* **Repair loops** - attempts after the first
* **Tokens and cost** - per run, in USD and INR (`pricing.yaml`)
* **Audit chain intact** - the run's audit log verifies

## Results

Latest replay run (harness validation, not a model score): see
[`results/latest_replay.md`](results/latest_replay.md) - 100% (28/28 variables,
306/306 subjects) after one repair loop.

Live model results: run `--mode live` and commit `results/latest_live.md`.

## Data notice

`data/` contains CSV conversions of datasets from
[pharmaversesdtm](https://github.com/pharmaverse/pharmaversesdtm) and
[pharmaverseadam](https://github.com/pharmaverse/pharmaverseadam), licensed under
the Apache License 2.0. Source URLs and checksums are in `data/manifest.json`.
