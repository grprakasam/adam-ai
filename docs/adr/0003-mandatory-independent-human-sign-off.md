# 0003 - Mandatory, independent human sign-off; no API auto-approval

* Status: Accepted (2026-10-23)

## Context
Generated programs feed regulatory deliverables. Accountability must sit with a
qualified person, and the four-eyes principle is standard in QC.

## Decision
* Runs stop at `human_review` until someone approves or rejects.
* Only `senior_developer` and `admin` roles can sign off, and by default not the
  person who started the run (`ADAM_AGENT_REQUIRE_INDEPENDENT_REVIEW=true`).
* The reviewer identity comes from the authenticated user, not the request body.
* `auto_approve` exists only for the offline benchmark/CI runner and cannot approve
  a run that failed its checks (escalated runs are auto-rejected).

## Consequences
* Each approval is attributable and linked to a code hash in the audit log.
* Throughput depends on reviewer availability; the review packet (checks,
  match rates, cost) is designed to keep reviews short.
