# 0004 - Cheap-first model routing and per-run cost tracking

* Status: Accepted (2026-10-23)

## Context
Most ADSL variables are copies or simple recodes. Sending every attempt to the
largest model wastes money; sending everything to the smallest hurts quality on
hard derivations.

## Decision
`ModelRouter` takes an ordered list of `provider:model` routes (cheapest first,
`ADAM_AGENT_ROUTES`) and escalates one tier per failed attempt
(`ADAM_AGENT_ESCALATE_AFTER`). Every model call is recorded with tokens, cache
tokens, USD and INR (`pricing.yaml`, `ADAM_AGENT_USD_INR`).

## Consequences
* Cost per ADaM dataset becomes a reported metric (benchmark and audit log).
* Prices change; `pricing.yaml` records an `as_of` date per model and can be
  overridden. Unknown models are tracked by tokens with cost reported as null.
