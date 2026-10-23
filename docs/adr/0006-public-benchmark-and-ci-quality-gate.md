# 0006 - Public pharmaverse benchmark as a CI quality gate

* Status: Accepted (2026-10-23)

## Context
Claims like "it generates correct ADaM code" need evidence that anyone can
reproduce, without client data.

## Decision
Benchmark on `pharmaversesdtm` v1.5.0 inputs against `pharmaverseadam` v1.4.0
ADSL (both Apache-2.0, CDISC pilot study), pinned by tag with checksums in
`data/manifest.json`. Two modes:
* `replay`: runs a golden program through the full graph (with an injected first-
  attempt fault) - proves harness, gates and repair loop; runs in CI on every push
  and fails the build below 100% match or on a broken audit chain.
* `live`: real model generation; on demand or weekly when secrets are configured.

## Consequences
* The golden program reproduces all 28 benchmark variables for all 306 subjects.
* Replay results say nothing about model quality; only live results do.
* Extending to ADAE/ADVS needs specs and reference files in the same layout.
