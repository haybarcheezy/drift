# Schemas for data validation and serialization are defined in this file.
# The player and pitch schemas are implemented for you already but feel free to add more fields or schemas as needed.

from marshmallow import EXCLUDE, Schema, fields, validate


class CoercedFloat(fields.Field):
    """Serialize a TEXT column to a float, treating ''/None/garbage as null.

    The pitches table was ingested from CSV and stores numeric data as TEXT;
    coercing at the serialization boundary means the API emits real JSON
    numbers and the frontend never has to parse strings.
    """

    def _serialize(self, value, attr, obj, **kwargs):
        try:
            return float(value) if value not in (None, "") else None
        except (TypeError, ValueError):
            return None


class CoercedInt(fields.Field):
    """Serialize a TEXT column to an int, treating ''/None/garbage as null."""

    def _serialize(self, value, attr, obj, **kwargs):
        try:
            return int(float(value)) if value not in (None, "") else None
        except (TypeError, ValueError):
            return None


class PlayerSchema(Schema):
    """Schema for player data validation and serialization."""

    player_id = fields.Integer(required=True)
    first_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    last_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    birthdate = fields.String(required=True)
    birth_country = fields.String(allow_none=True)
    birth_state = fields.String(allow_none=True)
    height_feet = fields.Integer(required=True, validate=validate.Range(min=4, max=8))
    height_inches = fields.Integer(
        required=True, validate=validate.Range(min=0, max=11)
    )
    weight = fields.Integer(required=True, validate=validate.Range(min=100, max=400))
    team = fields.String(required=True, validate=validate.Length(min=2, max=3))
    primary_position = fields.String(required=True)
    throws = fields.String(required=True, validate=validate.OneOf(["R", "L"]))
    bats = fields.String(required=True, validate=validate.OneOf(["R", "L", "S"]))


class PitchSchema(Schema):
    """Schema for pitch data validation and serialization."""

    # Pitch identification
    rowid = fields.Integer()
    pitch_type = fields.String(allow_none=True)
    pitch_name = fields.String(allow_none=True)
    game_date = fields.String(required=True)

    # Pitcher and batter. player_name is the pitcher, "Last, First" format.
    player_name = fields.String(allow_none=True)
    pitcher = fields.Integer(required=True)
    batter = fields.Integer(required=True)

    # Pitch characteristics (TEXT in the DB; coerced to numbers on the way out)
    release_speed = CoercedFloat(allow_none=True)
    release_spin_rate = CoercedFloat(allow_none=True)
    release_pos_x = CoercedFloat(allow_none=True)
    release_pos_y = CoercedFloat(allow_none=True)
    release_pos_z = CoercedFloat(allow_none=True)
    effective_speed = CoercedFloat(allow_none=True)
    spin_axis = CoercedFloat(allow_none=True)

    # Kinematics for 3D flight reconstruction
    vx0 = CoercedFloat(allow_none=True)
    vy0 = CoercedFloat(allow_none=True)
    vz0 = CoercedFloat(allow_none=True)
    ax = CoercedFloat(allow_none=True)
    ay = CoercedFloat(allow_none=True)
    az = CoercedFloat(allow_none=True)
    pfx_x = CoercedFloat(allow_none=True)
    pfx_z = CoercedFloat(allow_none=True)

    # Pitch location
    plate_x = CoercedFloat(allow_none=True)
    plate_z = CoercedFloat(allow_none=True)
    zone = CoercedInt(allow_none=True)
    sz_top = CoercedFloat(allow_none=True)
    sz_bot = CoercedFloat(allow_none=True)

    # Game / at-bat identity
    game_pk = CoercedInt(allow_none=True)
    at_bat_number = CoercedInt(allow_none=True)
    pitch_number = CoercedInt(allow_none=True)

    # Pitch result
    type = fields.String(allow_none=True)  # S, B, X
    description = fields.String(allow_none=True)
    events = fields.String(allow_none=True)

    # Count and game situation
    balls = CoercedInt(allow_none=True)
    strikes = CoercedInt(allow_none=True)
    outs_when_up = CoercedInt(allow_none=True)
    inning = CoercedInt(allow_none=True)
    inning_topbot = fields.String(allow_none=True)

    # Batted ball data
    launch_speed = CoercedFloat(allow_none=True)
    launch_angle = CoercedFloat(allow_none=True)
    hit_distance_sc = CoercedFloat(allow_none=True)

    # Player handedness
    stand = fields.String(allow_none=True)  # L or R
    p_throws = fields.String(allow_none=True)  # L or R

    # Teams
    home_team = fields.String(allow_none=True)
    away_team = fields.String(allow_none=True)


# ---------------------------------------------------------------------------
# Query-string validation schemas (invalid params -> 400, not a silent scan)
# ---------------------------------------------------------------------------

class PlayerQuerySchema(Schema):
    """Validates /api/players query parameters."""

    class Meta:
        unknown = EXCLUDE

    team = fields.String(validate=validate.Length(min=2, max=3))
    position = fields.String(validate=validate.Length(min=1, max=5))
    search = fields.String(validate=validate.Length(min=1, max=100))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=50, validate=validate.Range(min=1, max=500))


class PitchQuerySchema(Schema):
    """Validates /api/pitches query parameters."""

    class Meta:
        unknown = EXCLUDE

    pitcher = fields.Integer()
    batter = fields.Integer()
    player_id = fields.Integer()  # matches pitches thrown OR seen by the player
    pitch_type = fields.String(validate=validate.Length(min=1, max=3))
    team = fields.String(validate=validate.Length(min=2, max=3))
    min_velocity = fields.Float(validate=validate.Range(min=0, max=110))
    max_velocity = fields.Float(validate=validate.Range(min=0, max=110))
    start_date = fields.Date()
    end_date = fields.Date()
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=50, validate=validate.Range(min=1, max=500))
