# 0009 - Static sandbox rules plus network-isolated execution

* Status: Accepted (2026-10-23)

## Context
Executing model-written code is a security risk (file access, network calls,
package installation, shell commands).

## Decision
Before execution, the static validator rejects file I/O, network, system, eval/
parse and `install.packages` calls and packages outside an allow-list (checked on
code with comments and string contents removed). The runner, not the generated
code, loads inputs and writes outputs. `ADAM_AGENT_EXECUTOR=docker` runs R in a
container with `--network none` and a memory cap; `local` uses Rscript for
development.

## Consequences
* Static rules are a first line of defence, not a complete sandbox; use Docker
  mode for anything beyond local development.
* Allowed packages are dplyr, tidyr, stringr, lubridate, purrr and tibble (plus
  haven for XPT inputs); extend `ALLOWED_PACKAGES` deliberately.
