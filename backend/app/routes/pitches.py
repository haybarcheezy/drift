"""Pitch endpoints: filtered, paginated pitch retrieval + 3D flight paths."""

from flask import Blueprint, abort, jsonify, request
from sqlalchemy import Float, cast, or_

from app.extensions import db
from app.models import Pitch
from app.physics.trajectory import flight_from_pitch_fields
from app.routes import load_query_params, paginate
from app.schemas import PitchQuerySchema, PitchSchema

pitches_bp = Blueprint("pitches", __name__)

pitches_schema = PitchSchema(many=True)
pitch_schema = PitchSchema()
pitch_query_schema = PitchQuerySchema()

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
