"""Pitch endpoints: filtered, paginated pitch retrieval + 3D flight paths."""

from flask import Blueprint, abort, jsonify, request
from sqlalchemy import Float, cast, or_

from app.extensions import db
from app.models import Pitch
from app.physics.trajectory import flight_from_pitch_fields
from app.routes import load_query_params, paginate
from app.schemas import AtBatQuerySchema, PitchQuerySchema, PitchSchema

pitches_bp = Blueprint("pitches", __name__)

pitches_schema = PitchSchema(many=True)
pitch_schema = PitchSchema()
pitch_query_schema = PitchQuerySchema()
at_bat_query_schema = AtBatQuerySchema()

# Columns needed to reconstruct a flight path (may be TEXT in SQLite).
_FLIGHT_FIELD_NAMES = (
    "release_pos_x",
    "release_pos_y",
    "release_pos_z",
    "vx0",
    "vy0",
    "vz0",
    "ax",
    "ay",
    "az",
    "plate_x",
    "plate_z",
)


def _pitch_flight_payload(pitch: Pitch) -> dict:
    fields = {name: getattr(pitch, name, None) for name in _FLIGHT_FIELD_NAMES}
    try:
        flight = flight_from_pitch_fields(fields)
    except ValueError as exc:
        abort(422, description=str(exc))
    return {"pitch": pitch_schema.dump(pitch), "flight": flight}


@pitches_bp.route("/pitches", methods=["GET"])
def get_pitches():
    """List pitches with optional filters and pagination.

    Query params:
        pitcher      - player_id, pitches *thrown* by the player
        batter       - player_id, pitches *seen* by the player
        player_id    - pitches thrown OR seen by the player
        pitch_type   - e.g. FF, SL, CH
        team         - pitches from games involving the team (home or away)
        min_velocity / max_velocity - release speed bounds in mph
        start_date / end_date       - game date bounds (YYYY-MM-DD)
        page / per_page             - pagination (default 1 / 50, max 500)

    NOTE: release_speed is stored as TEXT in the SQLite DB (raw CSV ingest),
    so velocity filters CAST to REAL. Without the cast SQLite compares
    TEXT > INTEGER for *any* string value and the filter silently returns
    wrong rows.
    """
    params = load_query_params(pitch_query_schema, request.args)

    query = Pitch.query
    if "pitcher" in params:
        query = query.filter(Pitch.pitcher == params["pitcher"])
    if "batter" in params:
        query = query.filter(Pitch.batter == params["batter"])
    if "player_id" in params:
        query = query.filter(
            or_(Pitch.pitcher == params["player_id"], Pitch.batter == params["player_id"])
        )
    if "pitch_type" in params:
        query = query.filter(Pitch.pitch_type == params["pitch_type"].upper())
    if "team" in params:
        team = params["team"].upper()
        query = query.filter(or_(Pitch.home_team == team, Pitch.away_team == team))

    speed = cast(Pitch.release_speed, Float)
    if "min_velocity" in params or "max_velocity" in params:
        # Exclude rows with no recorded velocity from range filters.
        query = query.filter(Pitch.release_speed.isnot(None), Pitch.release_speed != "")
    if "min_velocity" in params:
        query = query.filter(speed >= params["min_velocity"])
    if "max_velocity" in params:
        query = query.filter(speed <= params["max_velocity"])

    if "start_date" in params:
        query = query.filter(Pitch.game_date >= params["start_date"].isoformat())
    if "end_date" in params:
        query = query.filter(Pitch.game_date <= params["end_date"].isoformat())

    query = query.order_by(Pitch.game_date.desc(), Pitch.rowid)

    pitches, pagination = paginate(query, params["page"], params["per_page"])
    return jsonify({"data": pitches_schema.dump(pitches), "pagination": pagination}), 200


@pitches_bp.route("/pitches/types", methods=["GET"])
def get_pitch_types():
    """Distinct pitch types with display names (drives the filter dropdown)."""
    rows = (
        db.session.query(Pitch.pitch_type, Pitch.pitch_name)
        .filter(Pitch.pitch_type.isnot(None), Pitch.pitch_type != "")
        .distinct()
        .order_by(Pitch.pitch_type)
        .all()
    )
    return jsonify([{"code": r.pitch_type, "name": r.pitch_name} for r in rows]), 200


@pitches_bp.route("/pitches/<int:rowid>/flight", methods=["GET"])
def get_pitch_flight(rowid: int):
    """Reconstruct the 3D flight path for a single pitch.

    Uses full Statcast kinematics when available; otherwise linear
    release→plate fallback. Returns 422 when neither is possible.
    """
    pitch = db.session.get(Pitch, rowid)
    if pitch is None:
        abort(404, description="Pitch not found")
    return jsonify(_pitch_flight_payload(pitch)), 200


@pitches_bp.route("/at-bats", methods=["GET"])
def list_at_bats():
    """Paginated at-bat summaries for a pitcher and/or batter.

    Query params:
        pitcher   - player_id (throws)
        batter    - player_id (sees)
        page / per_page

    At least one of pitcher or batter is required. Both = matchup filter.
    Each row is one plate appearance with pitch count, sequence types,
    result, and the first pitch rowid (for opening the theater).
    """
    params = load_query_params(at_bat_query_schema, request.args)
    if "pitcher" not in params and "batter" not in params:
        abort(400, description="pitcher or batter is required")

    query = Pitch.query.filter(
        Pitch.game_pk.isnot(None),
        Pitch.game_pk != "",
        Pitch.at_bat_number.isnot(None),
        Pitch.at_bat_number != "",
    )
    if "pitcher" in params:
        query = query.filter(Pitch.pitcher == params["pitcher"])
    if "batter" in params:
        query = query.filter(Pitch.batter == params["batter"])

    # Distinct PA keys ordered by most recent game first.
    keys_q = (
        query.with_entities(
            Pitch.game_pk,
            Pitch.at_bat_number,
            Pitch.game_date,
        )
        .distinct()
        .order_by(Pitch.game_date.desc(), Pitch.game_pk.desc(), Pitch.at_bat_number.desc())
    )
    keys = keys_q.all()
    total = len(keys)
    page = params["page"]
    per_page = params["per_page"]
    total_pages = max(1, (total + per_page - 1) // per_page) if total else 0
    start = (page - 1) * per_page
    page_keys = keys[start : start + per_page]

    data = []
    for game_pk, at_bat_number, _game_date in page_keys:
        pa_pitches = (
            Pitch.query.filter(
                Pitch.game_pk == game_pk,
                Pitch.at_bat_number == at_bat_number,
            )
            .order_by(cast(Pitch.pitch_number, Float).asc(), Pitch.rowid.asc())
            .all()
        )
        if "pitcher" in params:
            pa_pitches = [p for p in pa_pitches if p.pitcher == params["pitcher"]]
        if "batter" in params:
            pa_pitches = [p for p in pa_pitches if p.batter == params["batter"]]
        if not pa_pitches:
            continue

        lead = pa_pitches[0]
        last = pa_pitches[-1]
        result = None
        for p in reversed(pa_pitches):
            if p.events:
                result = p.events
                break
        if result is None and last.description:
            result = last.description

        types: list[str] = []
        for p in pa_pitches:
            code = p.pitch_type or "?"
            types.append(code)

        data.append(
            {
                "game_pk": int(float(game_pk)) if str(game_pk).replace(".", "", 1).isdigit() else game_pk,
                "at_bat_number": int(float(at_bat_number))
                if str(at_bat_number).replace(".", "", 1).isdigit()
                else at_bat_number,
                "game_date": lead.game_date,
                "pitcher": lead.pitcher,
                "batter": lead.batter,
                "pitcher_name": lead.player_name,
                "home_team": lead.home_team,
                "away_team": lead.away_team,
                "inning": int(float(lead.inning))
                if lead.inning not in (None, "")
                else None,
                "inning_topbot": lead.inning_topbot,
                "pitch_count": len(pa_pitches),
                "pitch_types": types,
                "result": result,
                "first_pitch_rowid": lead.rowid,
                "pitches": [
                    {
                        "rowid": p.rowid,
                        "pitch_number": int(float(p.pitch_number))
                        if p.pitch_number not in (None, "")
                        else idx + 1,
                        "pitch_type": p.pitch_type,
                        "pitch_name": p.pitch_name,
                        "release_speed": float(p.release_speed)
                        if p.release_speed not in (None, "")
                        else None,
                        "description": p.description,
                        "events": p.events,
                    }
                    for idx, p in enumerate(pa_pitches)
                ],
            }
        )

    return (
        jsonify(
            {
                "data": data,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages,
                },
            }
        ),
        200,
    )


@pitches_bp.route("/games/<int:game_pk>/at-bats/<int:at_bat_number>", methods=["GET"])
def get_at_bat(game_pk: int, at_bat_number: int):
    """Ordered pitches in an at-bat, each with an embedded flight path.

    Powers tunnel compare and at-bat cinema in the Pitch Theater.
    """
    pitches = (
        Pitch.query.filter(
            Pitch.game_pk == str(game_pk),
            Pitch.at_bat_number == str(at_bat_number),
        )
        .order_by(cast(Pitch.pitch_number, Float).asc(), Pitch.rowid.asc())
        .all()
    )
    if not pitches:
        abort(404, description="At-bat not found")

    items = []
    for pitch in pitches:
        fields = {name: getattr(pitch, name, None) for name in _FLIGHT_FIELD_NAMES}
        try:
            flight = flight_from_pitch_fields(fields)
        except ValueError:
            flight = None
        items.append({"pitch": pitch_schema.dump(pitch), "flight": flight})

    lead = pitches[0]
    return (
        jsonify(
            {
                "game_pk": game_pk,
                "at_bat_number": at_bat_number,
                "pitcher": lead.pitcher,
                "batter": lead.batter,
                "game_date": lead.game_date,
                "pitches": items,
            }
        ),
        200,
    )
