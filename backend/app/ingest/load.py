"""Persist external-source rows into the local warehouse (SQLAlchemy)."""

from __future__ import annotations

from datetime import date
from typing import Any, Iterable

from sqlalchemy import delete

from app.extensions import db
from app.models import Pitch, Player

# String columns on Pitch (everything except PK + pitcher/batter ints).
_PITCH_STRING_FIELDS = (
    "pitch_type",
    "pitch_name",
    "game_date",
    "player_name",
    "release_speed",
    "release_spin_rate",
    "release_pos_x",
    "release_pos_y",
    "release_pos_z",
    "effective_speed",
    "spin_axis",
    "vx0",
    "vy0",
    "vz0",
    "ax",
    "ay",
    "az",
    "pfx_x",
    "pfx_z",
    "plate_x",
    "plate_z",
    "zone",
    "sz_top",
    "sz_bot",
    "game_pk",
    "at_bat_number",
    "pitch_number",
    "delta_run_exp",
    "type",
    "description",
    "events",
    "balls",
    "strikes",
    "outs_when_up",
    "inning",
    "inning_topbot",
    "launch_speed",
    "launch_angle",
    "hit_distance_sc",
    "stand",
    "p_throws",
    "home_team",
    "away_team",
)


def _str_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text != "" else None


def _int_required(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def pitch_row_from_savant(raw: dict[str, Any]) -> Pitch | None:
    """Map a Savant CSV row dict → Pitch instance. None if unusable."""
    game_date = _str_or_none(raw.get("game_date"))
    if not game_date:
        return None
    pitcher = _int_required(raw.get("pitcher"))
    batter = _int_required(raw.get("batter"))
    if pitcher == 0 and batter == 0:
        return None

    kwargs: dict[str, Any] = {
        "game_date": game_date,
        "pitcher": pitcher,
        "batter": batter,
    }
    for field in _PITCH_STRING_FIELDS:
        if field == "game_date":
            continue
        kwargs[field] = _str_or_none(raw.get(field))
    return Pitch(**kwargs)


def upsert_players(rows: Iterable[dict[str, Any]]) -> dict[str, int]:
    """Insert or update players by primary key player_id."""
    inserted = updated = 0
    for row in rows:
        existing = db.session.get(Player, row["player_id"])
        if existing is None:
            db.session.add(Player(**row))
            inserted += 1
        else:
            for key, value in row.items():
                if key == "player_id":
                    continue
                setattr(existing, key, value)
            updated += 1
    db.session.commit()
    return {"inserted": inserted, "updated": updated, "total": inserted + updated}


def replace_pitches_for_dates(
    rows: list[dict[str, Any]],
    start: date,
    end: date,
) -> dict[str, int]:
    """Delete pitches in [start, end] then bulk-insert mapped Savant rows.

    Day-window replace keeps re-runs idempotent without a composite unique index.
    """
    start_s, end_s = start.isoformat(), end.isoformat()
    deleted = (
        db.session.execute(
            delete(Pitch).where(Pitch.game_date >= start_s, Pitch.game_date <= end_s)
        ).rowcount
        or 0
    )

    objects: list[Pitch] = []
    for raw in rows:
        pitch = pitch_row_from_savant(raw)
        if pitch is not None:
            objects.append(pitch)

    if objects:
        db.session.bulk_save_objects(objects)
    db.session.commit()
    return {"deleted": int(deleted), "inserted": len(objects)}


def wipe_all_pitches() -> int:
    count = db.session.query(Pitch).delete()
    db.session.commit()
    return int(count or 0)


def wipe_all_players() -> int:
    count = db.session.query(Player).delete()
    db.session.commit()
    return int(count or 0)
