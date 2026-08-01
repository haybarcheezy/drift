"""Player endpoints: listing/filtering, detail, reference data, and arsenal."""

from flask import Blueprint, jsonify, request
from sqlalchemy import Float, cast, func, or_

from app.extensions import db
from app.models import Pitch, Player
from app.routes import load_query_params, paginate
from app.schemas import PlayerQuerySchema, PlayerSchema

players_bp = Blueprint("players", __name__)

player_schema = PlayerSchema()
players_schema = PlayerSchema(many=True)
player_query_schema = PlayerQuerySchema()


@players_bp.route("/players", methods=["GET"])
def get_players():
    """List players with optional team/position/name-search filters.

    Query params: team, position, search, page, per_page
    """
    params = load_query_params(player_query_schema, request.args)

    query = Player.query
    if "team" in params:
        query = query.filter(Player.team == params["team"].upper())
    if "position" in params:
        query = query.filter(Player.primary_position == params["position"].upper())
    if "search" in params:
        pattern = f"%{params['search']}%"
        query = query.filter(
            or_(Player.first_name.ilike(pattern), Player.last_name.ilike(pattern))
        )
    query = query.order_by(Player.last_name, Player.first_name)

    players, pagination = paginate(query, params["page"], params["per_page"])
    return (
        jsonify({"data": players_schema.dump(players), "pagination": pagination}),
        200,
    )


@players_bp.route("/players/<int:player_id>", methods=["GET"])
def get_player(player_id: int):
    """Fetch a single player by id; 404 if not found."""
    player = db.session.get(Player, player_id)
    if player is None:
        return jsonify({"error": f"Player {player_id} not found"}), 404
    return jsonify(player_schema.dump(player)), 200


@players_bp.route("/players/teams", methods=["GET"])
def get_teams():
    """Distinct team codes (drives the frontend filter dropdown)."""
    teams = [
        t for (t,) in db.session.query(Player.team).distinct().order_by(Player.team)
    ]
    return jsonify(teams), 200


@players_bp.route("/players/positions", methods=["GET"])
def get_positions():
    """Distinct position codes (drives the frontend filter dropdown)."""
    positions = [
        p
        for (p,) in db.session.query(Player.primary_position)
        .distinct()
        .order_by(Player.primary_position)
    ]
    return jsonify(positions), 200


@players_bp.route("/players/<int:player_id>/arsenal", methods=["GET"])
def get_player_arsenal(player_id: int):
    """Pitch-arsenal summary for a pitcher: usage and velo/spin by pitch type.

    Numeric pitch columns are stored as TEXT in the SQLite DB, so aggregates
    CAST to REAL explicitly - otherwise SQLite would compare/aggregate
    lexicographically and produce silently wrong numbers.
    """
    player = db.session.get(Player, player_id)
    if player is None:
        return jsonify({"error": f"Player {player_id} not found"}), 404

    speed = cast(Pitch.release_speed, Float)
    spin = cast(Pitch.release_spin_rate, Float)

    rows = (
        db.session.query(
            Pitch.pitch_type,
            Pitch.pitch_name,
            func.count().label("count"),
            func.round(func.avg(speed), 1).label("avg_velocity"),
            func.round(func.max(speed), 1).label("max_velocity"),
            func.round(func.avg(spin), 0).label("avg_spin_rate"),
        )
        .filter(
            Pitch.pitcher == player_id,
            Pitch.pitch_type.isnot(None),
            Pitch.pitch_type != "",
        )
        .group_by(Pitch.pitch_type, Pitch.pitch_name)
        .order_by(func.count().desc())
        .all()
    )

    total = sum(r.count for r in rows)
    arsenal = [
        {
            "pitch_type": r.pitch_type,
            "pitch_name": r.pitch_name,
            "count": r.count,
            "usage_pct": round(100.0 * r.count / total, 1) if total else 0.0,
            "avg_velocity": r.avg_velocity,
            "max_velocity": r.max_velocity,
            "avg_spin_rate": r.avg_spin_rate,
        }
        for r in rows
    ]

    return (
        jsonify(
            {
                "player": player_schema.dump(player),
                "total_pitches": total,
                "arsenal": arsenal,
            }
        ),
        200,
    )
