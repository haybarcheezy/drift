# Contributing to DRIFT

Thanks for taking a look. DRIFT is a two-part app: a Flask API that serves Statcast-derived
pitch data, and a React/TypeScript client that renders the 3D pitch theater and drift views.

## Setup

Backend (Python 3.12):

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate        # Windows
source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
flask --app main run --host=0.0.0.0 --port=5001 --debug
```

Frontend (Node 20):

```bash
cd frontend
npm install
npm start
```

The client expects the API on `http://localhost:5001` and serves on `http://localhost:3000`.

## Before opening a pull request

Both suites run in CI on every pull request, so run them locally first:

```bash
cd backend && python -m pytest tests/ -v
cd frontend && npx tsc --noEmit && npx vitest run
```

Keep pull requests focused. One logical change per PR is easier to review than a branch that
mixes a data-shape change with a rendering change, since the two halves fail in different ways.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: pitcher and batter side rails with at-bat list API
fix(theater): stable PitchTheater key so stage instance is not remounted
docs: add contributing guide
```

Scopes in use: `theater`, `ingest`, `api`, `ui`. A commit that only touches documentation does
not need a scope.

## Ingest

The Savant pull is rate-limited on purpose. Leave `--delay` at its default (1.5s between days)
unless you have a reason to change it, and never run a wide date range against the live endpoint
in a loop.

## Reporting bugs

Use the bug report issue form and include the pitch or game identifiers involved (`game_pk`,
`play_id`, pitch row id). Most rendering problems trace back to a specific row, and having the id
up front saves a round trip.
