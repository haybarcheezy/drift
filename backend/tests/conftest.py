"""Shared test fixtures.

Tests run against a seeded in-memory SQLite database rather than the real
baseball.db so they are fast, deterministic, and independent of the shipped
data.
"""

import pytest

from app import create_app
from app.extensions import db
from app.models import Pitch, Player

PLAYERS = [
    dict(
        player_id=1,
        first_name="Jose",
        last_name="Altuve",
        birthdate="1990-05-06",
        birth_country="Venezuela",
        birth_state=None,
        height_feet=5,
        height_inches=6,
        weight=166,
        team="HOU",
        primary_position="2B",
        throws="R",
        bats="R",
    ),
    dict(
        player_id=2,
        first_name="Framber",
        last_name="Valdez",
        birthdate="1993-11-19",
        birth_country="Dominican Republic",
        birth_state=None,
        height_feet=5,
        height_inches=11,
        weight=239,
        team="HOU",
        primary_position="LHS",
        throws="L",
        bats="L",
    ),
    dict(
        player_id=3,
        first_name="Shohei",
        last_name="Ohtani",
        birthdate="1994-07-05",
        birth_country="Japan",
        birth_state=None,
        height_feet=6,
        height_inches=4,
        weight=210,
        team="LAD",
        primary_position="DH",
        throws="R",
        bats="L",
    ),
]

# Numeric pitch values are seeded as strings on purpose - that mirrors the
# real database, where every pitch column is TEXT from the raw CSV ingest.
# Kinematics on the first two pitches enable flight/tunnel API tests.
_VALDEZ_SI_KIN = dict(
    release_pos_x="-1.8",
    release_pos_y="54.2",
    release_pos_z="5.9",
    vx0="3.5",
    vy0="-128.0",
    vz0="-3.2",
    ax="8.1",
    ay="28.0",
    az="-18.5",
    plate_x="0.15",
    plate_z="2.45",
    pfx_x="0.85",
    pfx_z="0.40",
    sz_top="3.4",
    sz_bot="1.55",
    game_pk="700001",
    at_bat_number="3",
)

PITCHES = [
    # Valdez sinkers + a curveball to Ohtani (same at-bat for tunnel tests)
    dict(
        game_date="2025-10-01",
        pitch_type="SI",
        pitch_name="Sinker",
        player_name="Valdez, Framber",
        pitcher=2,
        batter=3,
        release_speed="94.1",
        release_spin_rate="2100",
        type="S",
        description="called_strike",
        balls="0",
        strikes="0",
        inning="1",
        home_team="HOU",
        away_team="LAD",
        stand="L",
        p_throws="L",
        pitch_number="1",
        **_VALDEZ_SI_KIN,
    ),
    dict(
        game_date="2025-10-01",
        pitch_type="SI",
        pitch_name="Sinker",
        player_name="Valdez, Framber",
        pitcher=2,
        batter=3,
        release_speed="95.3",
        release_spin_rate="2150",
        type="B",
        description="ball",
        balls="0",
        strikes="1",
        inning="1",
        home_team="HOU",
        away_team="LAD",
        stand="L",
        p_throws="L",
        pitch_number="2",
        release_pos_x="-1.75",
        release_pos_y="54.15",
        release_pos_z="5.85",
        vx0="2.8",
        vy0="-129.5",
        vz0="-2.1",
        ax="7.5",
        ay="28.5",
        az="-17.0",
        plate_x="-0.4",
        plate_z="2.8",
        pfx_x="0.75",
        pfx_z="0.55",
        sz_top="3.4",
        sz_bot="1.55",
        game_pk="700001",
        at_bat_number="3",
    ),
    dict(
        game_date="2025-10-02",
        pitch_type="CU",
        pitch_name="Curveball",
        player_name="Valdez, Framber",
        pitcher=2,
        batter=3,
        release_speed="79.8",
        release_spin_rate="2800",
        type="X",
        description="hit_into_play",
        events="single",
        balls="1",
        strikes="1",
        inning="3",
        home_team="LAD",
        away_team="HOU",
        stand="L",
        p_throws="L",
        # Linear-fallback case: release + plate only, no kinematics
        release_pos_x="-1.9",
        release_pos_z="6.0",
        plate_x="0.2",
        plate_z="1.9",
        game_pk="700002",
        at_bat_number="12",
        pitch_number="1",
    ),
    # A pitch with no recorded velocity or path data (mirrors real data gaps)
    dict(
        game_date="2025-10-03",
        pitch_type="FF",
        pitch_name="4-Seam Fastball",
        player_name="Valdez, Framber",
        pitcher=2,
        batter=1,
        release_speed="",
        release_spin_rate="",
        type="B",
        description="ball",
        balls="0",
        strikes="0",
        inning="5",
        home_team="HOU",
        away_team="LAD",
        stand="R",
        p_throws="L",
        game_pk="700003",
        at_bat_number="1",
        pitch_number="1",
    ),
]


@pytest.fixture
def app():
    """App bound to a seeded in-memory database."""
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    with app.app_context():
        db.create_all()
        db.session.add_all([Player(**p) for p in PLAYERS])
        db.session.add_all([Pitch(**p) for p in PITCHES])
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
