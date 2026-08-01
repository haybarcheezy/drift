"""Baseball Savant Statcast CSV client (pitch-level kinematics).

Source: https://baseballsavant.mlb.com/statcast_search/csv
This is the same field schema as official Statcast exports - not the
static sample CSV.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from typing import Any, Iterator
from urllib.parse import urlencode

from app.ingest.http_util import fetch_bytes

SAVANT_CSV_URL = "https://baseballsavant.mlb.com/statcast_search/csv"

# Columns we map into the Pitch model / flight physics.
PITCH_COLUMNS = (
    "pitch_type",
    "game_date",
    "release_speed",
    "release_pos_x",
    "release_pos_y",
    "release_pos_z",
    "player_name",
    "batter",
    "pitcher",
    "events",
    "description",
    "zone",
    "stand",
    "p_throws",
    "home_team",
    "away_team",
    "type",
    "balls",
    "strikes",
    "pfx_x",
    "pfx_z",
    "plate_x",
    "plate_z",
    "outs_when_up",
    "inning",
    "inning_topbot",
    "vx0",
    "vy0",
    "vz0",
    "ax",
    "ay",
    "az",
    "sz_top",
    "sz_bot",
    "hit_distance_sc",
    "launch_speed",
    "launch_angle",
    "effective_speed",
    "release_spin_rate",
    "game_pk",
    "pitch_name",
    "spin_axis",
    "at_bat_number",
    "pitch_number",
    "delta_run_exp",
)


def _season_from_date(d: date) -> int:
    return d.year


def build_search_url(
    start: date,
    end: date,
    *,
    game_types: str = "R|",  # regular season; add PO|S| for postseason/spring
    season: int | None = None,
) -> str:
    """Build a Statcast detail CSV URL for [start, end] inclusive."""
    if end < start:
        raise ValueError("end must be >= start")
    sea = season or _season_from_date(start)
    # Savant uses trailing pipes on multi-select filters.
    params = {
        "all": "true",
        "hfPT": "",
        "hfAB": "",
        "hfGT": game_types if game_types.endswith("|") else f"{game_types}|",
        "hfPR": "",
        "hfZ": "",
        "hfStadium": "",
        "hfBBL": "",
        "hfNewZones": "",
        "hfPull": "",
        "hfC": "",
        "hfSea": f"{sea}|",
        "hfSit": "",
        "player_type": "pitcher",
        "hfOuts": "",
        "hfOpponent": "",
        "pitcher_throws": "",
        "batter_stands": "",
        "hfSA": "",
        "game_date_gt": start.isoformat(),
        "game_date_lt": end.isoformat(),
        "hfMo": "",
        "hfTeam": "",
        "home_road": "",
        "hfRO": "",
        "position": "",
        "hfInfield": "",
        "hfOutfield": "",
        "hfInn": "",
        "hfBBT": "",
        "hfFlag": "",
        "metric_1": "",
        "group_by": "name",
        "min_pitches": "0",
        "min_results": "0",
        "min_pas": "0",
        "sort_col": "pitches",
        "player_event_sort": "api_p_release_speed",
        "sort_order": "desc",
        "type": "details",
    }
    return f"{SAVANT_CSV_URL}?{urlencode(params)}"


def parse_csv(raw: bytes) -> list[dict[str, Any]]:
    """Parse Savant CSV bytes into row dicts (string values, BOM-safe)."""
    text = raw.decode("utf-8-sig")
    # Empty result pages sometimes return a single error line.
    if not text.strip() or text.strip().lower().startswith("<!"):
        return []
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    for row in reader:
        if not row.get("game_date") and not row.get("pitcher"):
            continue
        cleaned = {k: (row.get(k) if row.get(k) not in (None,) else "") for k in PITCH_COLUMNS}
        # Keep only known columns; missing keys → empty string
        for k in PITCH_COLUMNS:
            cleaned.setdefault(k, "")
            if cleaned[k] is None:
                cleaned[k] = ""
        rows.append(cleaned)
    return rows


def fetch_statcast_range(
    start: date,
    end: date,
    *,
    game_types: str = "R|",
    season: int | None = None,
    fetch: Any = fetch_bytes,
) -> list[dict[str, Any]]:
    """Download one Statcast window. Prefer single-day chunks for reliability."""
    url = build_search_url(start, end, game_types=game_types, season=season)
    raw = fetch(url)
    return parse_csv(raw)


def iter_daily(
    start: date,
    end: date,
) -> Iterator[tuple[date, date]]:
    """Yield inclusive single-day windows from start→end."""
    cur = start
    while cur <= end:
        yield cur, cur
        cur += timedelta(days=1)


def parse_iso_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()
