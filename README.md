# DRIFT

**See the pitch. Catch the change.**

Cinematic Statcast pitch flight, tunnel compare, and season-long pitcher identity drift. Live data from Baseball Savant and MLB Stats API.

- **3D pitch theater** - kinematic reconstruction (release through plate), 150ms tunnel freeze
- **Live ingest** - day-chunked Savant pull, MLB Stats API rosters
- **Heat strip** - pick any pitch, stage updates instantly
- **Roadmap** - pitcher / batter rails, at-bat browser, Drift Index (usage, release, shape, weak spots over the season)

## Stack

| Layer | Tech |
|-------|------|
| API | Flask, SQLAlchemy, Marshmallow |
| Physics | Statcast 9-param trajectory sampler |
| UI | React, TypeScript, React Three Fiber |
| Data | Baseball Savant CSV export, MLB Stats API |

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
flask --app main run --host=0.0.0.0 --port=5001 --debug
```

### Frontend (new terminal)

```bash
cd frontend
npm install
npm start
```

- API: http://localhost:5001
- App: http://localhost:3000

### Live data

```bash
cd backend
.\.venv\Scripts\activate

python -m app.ingest sync --start 2026-07-01 --end 2026-07-01 --season 2026 --wipe
python -m app.ingest pitches --start 2026-07-01 --end 2026-07-07 --season 2026
```

| Domain | Source |
|--------|--------|
| Pitch kinematics | [Baseball Savant](https://baseballsavant.mlb.com/statcast_search) |
| Rosters / teams | [MLB Stats API](https://statsapi.mlb.com/api/) |

Be polite to Savant (`--delay`, default 1.5s between days).

## Core API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/pitches` | Filtered pitch list |
| `GET /api/pitches/<rowid>/flight` | Sampled 3D path + tunnel point |
| `GET /api/games/<game_pk>/at-bats/<n>` | Full PA with flights |
| `GET /api/players` | Roster search / filters |
| `GET /api/players/<id>/arsenal` | Pitch mix summary |
| `GET /health` | Liveness |

## Tests

```bash
cd backend && python -m pytest tests/ -v
cd frontend && npm run test:run
```

## Roadmap

1. [x] Pitcher left rail + batter right rail (search, at-bats, pitch chips, matchup)
2. [ ] Season backfill into warehouse (Postgres)
3. [ ] Drift Index v1 - rolling vs early-season baseline
4. [ ] Public deploy (API + CDN frontend)

### At-bat list API

`GET /api/at-bats?pitcher=<id>&batter=<id>&page=1&per_page=25`

Requires pitcher and/or batter. Returns plate-appearance summaries with pitch chips and `first_pitch_rowid` for the theater.

## Data note

Statcast export via Savant is unofficial for redistribution. Fine for engineering and demos. Public commercial launch needs ToS review or a licensed feed.
