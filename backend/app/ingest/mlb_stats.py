"""MLB Stats API client - official free roster / team metadata.

Base: https://statsapi.mlb.com/api/
No API key. Used for players (not pitch kinematics - those come from Savant).
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable

from app.ingest.http_util import fetch_bytes

STATS_BASE = "https://statsapi.mlb.com/api/v1"

_HEIGHT_RE = re.compile(r"(\d+)\s*'\s*(\d+)")


def _get_json(url: str, fetch: Callable[..., bytes] = fetch_bytes) -> Any:
    raw = fetch(url, headers={"Accept": "application/json"})
    return json.loads(raw.decode("utf-8"))


def fetch_teams(
    *,
    season: int,
    sport_id: int = 1,
    fetch: Callable[..., bytes] = fetch_bytes,
) -> list[dict[str, Any]]:
    url = f"{STATS_BASE}/teams?sportId={sport_id}&season={season}"
    data = _get_json(url, fetch=fetch)
    return data.get("teams", [])


def team_abbrev_map(
    *,
    season: int,
    fetch: Callable[..., bytes] = fetch_bytes,
) -> dict[int, str]:
    """MLB team id → 2-3 letter abbreviation (e.g. 117 → HOU)."""
    out: dict[int, str] = {}
    for t in fetch_teams(season=season, fetch=fetch):
        tid = t.get("id")
        abbr = t.get("abbreviation")
        if tid is not None and abbr:
            out[int(tid)] = str(abbr)
    return out


def fetch_sport_players(
    *,
    season: int,
    sport_id: int = 1,
    fetch: Callable[..., bytes] = fetch_bytes,
) -> list[dict[str, Any]]:
    url = f"{STATS_BASE}/sports/{sport_id}/players?season={season}"
    data = _get_json(url, fetch=fetch)
    return data.get("people", [])


def parse_height(height: str | None) -> tuple[int, int]:
    """Parse MLB height string like `6' 2\"` → (6, 2). Defaults (6, 0)."""
    if not height:
        return 6, 0
    m = _HEIGHT_RE.search(height)
    if not m:
        return 6, 0
    return int(m.group(1)), int(m.group(2))


def person_to_player_row(
    person: dict[str, Any],
    team_abbrevs: dict[int, str],
) -> dict[str, Any] | None:
    """Map MLB Stats person → Player model kwargs. Skip incomplete records."""
    pid = person.get("id")
    first = person.get("firstName") or person.get("useName")
    last = person.get("lastName")
    if not pid or not first or not last:
        return None

    team = person.get("currentTeam") or {}
    team_id = team.get("id")
    abbrev = team_abbrevs.get(int(team_id), "FA") if team_id is not None else "FA"

    pos = (person.get("primaryPosition") or {}).get("abbreviation") or "UT"
    bats = (person.get("batSide") or {}).get("code") or "R"
    throws = (person.get("pitchHand") or {}).get("code") or "R"
    if bats not in ("R", "L", "S"):
        bats = "R"
    if throws not in ("R", "L"):
        throws = "R"

    hf, hi = parse_height(person.get("height"))
    weight = person.get("weight") or 200
    try:
        weight = int(weight)
    except (TypeError, ValueError):
        weight = 200

    return {
        "player_id": int(pid),
        "first_name": str(first)[:100],
        "last_name": str(last)[:100],
        "birthdate": person.get("birthDate") or "1900-01-01",
        "birth_country": person.get("birthCountry"),
        "birth_state": person.get("birthStateProvince"),
        "height_feet": hf,
        "height_inches": hi,
        "weight": weight,
        "team": str(abbrev)[:3],
        "primary_position": str(pos)[:5],
        "throws": throws,
        "bats": bats,
    }


def fetch_player_rows(
    *,
    season: int,
    fetch: Callable[..., bytes] = fetch_bytes,
) -> list[dict[str, Any]]:
    abbrevs = team_abbrev_map(season=season, fetch=fetch)
    people = fetch_sport_players(season=season, fetch=fetch)
    rows: list[dict[str, Any]] = []
    for person in people:
        mapped = person_to_player_row(person, abbrevs)
        if mapped:
            rows.append(mapped)
    return rows
