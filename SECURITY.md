# Security policy

## Supported versions

DRIFT is deployed from `main`. Only the current tip of `main` receives fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

- Email **hayden@haydenbarnett.dev** with a description and, if possible, reproduction steps.
- Or use GitHub's [private vulnerability reporting](https://github.com/haybarcheezy/drift/security/advisories/new)
  on this repository.

Expect an acknowledgement within a few days. Once a fix is available I'll credit you in the
advisory unless you'd rather stay anonymous.

## Scope

Most of this project is read-only presentation of public baseball data, but a few areas are
worth naming explicitly:

| Area | Notes |
|------|-------|
| Ingest | The Savant and Stats API pulls take remote CSV/JSON and write to the local database. Unvalidated fields flow into the ORM. |
| API | Flask endpoints are unauthenticated by design; anything that turns a query parameter into a file path or raw SQL is in scope. |
| Frontend | React Three Fiber renders geometry parsed from API payloads; a payload that produces pathological geometry is in scope. |
| Dependencies | Report known-vulnerable pins in `backend/requirements.txt` or `frontend/package-lock.json`. |

## Out of scope

- Rate limiting or availability of the upstream MLB endpoints.
- Findings that require a local attacker with write access to the repo or database.
- Automated scanner output with no demonstrated impact.
