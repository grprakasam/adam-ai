# Development scripts

Manual smoke checks written while building the base application. They are not
part of the automated test suite (CI runs `backend/tests`). Run them from the
repository root with the backend virtual environment active, for example
`python scripts/dev/test_auth_quick.py`. Scripts that read
`Content/UserInputs/ADAMSpecifications/ADSLSpec.xlsx` need your own
specification there; sample specifications are not included in this repository.
