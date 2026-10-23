# 0002 - Deterministic gates before any human review; exact-match QC bar

* Status: Accepted (2026-10-23)

## Context
Model output is probabilistic. Reviewers' time is expensive, and reviewing code
that does not even run wastes it. In clinical programming, independent
double-programming QC expects outputs to match exactly.

## Decision
Every candidate passes, in order: static checks (sandbox rules, output contract,
variable coverage, CDISC naming, R parse), execution, and, when a reference
dataset exists, a variable-level comparison. Defaults require an exact match both
overall and for every variable (`match_threshold = variable_threshold = 1.0`).
Failures feed concrete feedback into a repair prompt, with a hard attempt cap.

## Consequences
* Humans only see code that ran and, where possible, matched the reference.
* An average-based bar was rejected after testing: a program with one wrong
  variable out of 28 still scored 97% overall.
* Thresholds are configurable for exploratory use, and every run records them.
