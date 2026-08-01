"""SQLAlchemy models for the baseball database.

NOTE: Pitch columns are stored as TEXT because the db was imported from CSV. SQLite type comparision rules mean numeric
filters like 'WHERE release_speed >= 95' would return bad data. The fix is casting columns to numeric types at query
time (routes/pitches.py handle this).
"""

from app.extensions import db


class Player(db.Model):
    """A player from the 2025 MLB postseason dataset."""

    __tablename__ = "players"

    player_id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    birthdate = db.Column(db.String, nullable=False)
    birth_country = db.Column(db.String, nullable=True)
    birth_state = db.Column(db.String, nullable=True)
    height_feet = db.Column(db.Integer, nullable=False)
    height_inches = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Integer, nullable=False)
    team = db.Column(db.String(3), nullable=False)
    primary_position = db.Column(db.String, nullable=False)
    throws = db.Column(db.String(1), nullable=False)
    bats = db.Column(db.String(1), nullable=False)


class Pitch(db.Model):
    """A single pitch event (subset of Baseball Savant fields)."""

    __tablename__ = "pitches"

    rowid = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # Pitch identification
    pitch_type = db.Column(db.String, nullable=True)
    pitch_name = db.Column(db.String, nullable=True)
    game_date = db.Column(db.String, nullable=False)

    # Pitcher and hitter. player_name is the pitcher in "Last, First" format.
    player_name = db.Column(db.String, nullable=True)
    pitcher = db.Column(db.Integer, nullable=False)
    batter = db.Column(db.Integer, nullable=False)

    # Pitch characteristics (TEXT in the underlying DB; cast at query time)
    release_speed = db.Column(db.String, nullable=True)
    release_spin_rate = db.Column(db.String, nullable=True)
    release_pos_x = db.Column(db.String, nullable=True)
    release_pos_y = db.Column(db.String, nullable=True)
    release_pos_z = db.Column(db.String, nullable=True)
    effective_speed = db.Column(db.String, nullable=True)
    spin_axis = db.Column(db.String, nullable=True)

    # Kinematics at release (ft, ft/s, ft/s²) - full flight reconstruction
    vx0 = db.Column(db.String, nullable=True)
    vy0 = db.Column(db.String, nullable=True)
    vz0 = db.Column(db.String, nullable=True)
    ax = db.Column(db.String, nullable=True)
    ay = db.Column(db.String, nullable=True)
    az = db.Column(db.String, nullable=True)

    # Induced break (feet)
    pfx_x = db.Column(db.String, nullable=True)
    pfx_z = db.Column(db.String, nullable=True)

    # Pitch location
    plate_x = db.Column(db.String, nullable=True)
    plate_z = db.Column(db.String, nullable=True)
    zone = db.Column(db.String, nullable=True)

    # Batter's strike zone bounds for this pitch (feet)
    sz_top = db.Column(db.String, nullable=True)
    sz_bot = db.Column(db.String, nullable=True)

    # Game / at-bat identity (Statcast)
    game_pk = db.Column(db.String, nullable=True)
    at_bat_number = db.Column(db.String, nullable=True)
    pitch_number = db.Column(db.String, nullable=True)

    # Run expectancy change from the batting team's perspective
    # (positive = good for the hitter, negative = good for the pitcher)
    delta_run_exp = db.Column(db.String, nullable=True)

    # Pitch result
    type = db.Column(db.String, nullable=True)  # S, B, X
    description = db.Column(db.String, nullable=True)
    events = db.Column(db.String, nullable=True)

    # Count and game situation
    balls = db.Column(db.String, nullable=True)
    strikes = db.Column(db.String, nullable=True)
    outs_when_up = db.Column(db.String, nullable=True)
    inning = db.Column(db.String, nullable=True)
    inning_topbot = db.Column(db.String, nullable=True)

    # Batted ball data
    launch_speed = db.Column(db.String, nullable=True)
    launch_angle = db.Column(db.String, nullable=True)
    hit_distance_sc = db.Column(db.String, nullable=True)

    # Handedness
    stand = db.Column(db.String, nullable=True)
    p_throws = db.Column(db.String, nullable=True)

    # Teams
    home_team = db.Column(db.String, nullable=True)
    away_team = db.Column(db.String, nullable=True)
