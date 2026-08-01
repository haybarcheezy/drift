"""Ingest unit tests - mocked HTTP, never hits Savant/MLB live."""

from datetime import date

import pytest

from app.extensions import db
from app.ingest.load import pitch_row_from_savant, replace_pitches_for_dates, upsert_players
from app.ingest.mlb_stats import parse_height, person_to_player_row
from app.ingest.savant import build_search_url, parse_csv
from app.models import Pitch, Player


_SAMPLE_FIELDS = [
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
]
_SAMPLE_VALUES = [
    "FF",
    "2026-07-01",
    "95.2",
    "-1.5",
    "54.5",
    "5.9",
    "Test Pitcher",
    "600001",
    "500001",
    "",
    "called_strike",
    "5",
    "R",
    "R",
    "NYY",
    "BOS",
    "S",
    "0",
    "0",
    "-0.5",
    "1.2",
    "0.1",
    "2.5",
    "1",
    "1",
    "Top",
    "4.0",
    "-130.0",
    "-3.0",
    "-5.0",
    "30.0",
    "-15.0",
    "3.5",
    "1.6",
    "",
    "",
    "",
    "94.0",
    "2200",
    "999001",
    "Four-Seam",
    "180",
    "3",
    "1",
    "0.01",
]
SAMPLE_CSV = "\ufeff" + ",".join(_SAMPLE_FIELDS) + "\n" + ",".join(_SAMPLE_VALUES) + "\n"


def test_build_search_url_contains_dates():
    url = build_search_url(date(2026, 7, 1), date(2026, 7, 1))
    assert "baseballsavant.mlb.com/statcast_search/csv" in url
    assert "game_date_gt=2026-07-01" in url
    assert "game_date_lt=2026-07-01" in url
    assert "type=details" in url
    assert "hfSea=2026" in url


def test_parse_csv_maps_kinematics():
    rows = parse_csv(SAMPLE_CSV.encode("utf-8"))
    assert len(rows) == 1
    r = rows[0]
    assert r["pitch_type"] == "FF"
    assert r["game_date"] == "2026-07-01"
    assert r["vx0"] == "4.0"
    assert r["release_pos_y"] == "54.5"
    assert r["game_pk"] == "999001"


def test_pitch_row_from_savant():
    rows = parse_csv(SAMPLE_CSV.encode("utf-8"))
    pitch = pitch_row_from_savant(rows[0])
    assert pitch is not None
    assert pitch.pitcher == 500001
    assert pitch.batter == 600001
    assert pitch.vx0 == "4.0"
    assert pitch.game_pk == "999001"


def test_parse_height():
    assert parse_height("6' 2\"") == (6, 2)
    assert parse_height("5' 11\"") == (5, 11)
    assert parse_height(None) == (6, 0)


def test_person_to_player_row():
    person = {
        "id": 123,
        "firstName": "Jose",
        "lastName": "Altuve",
        "birthDate": "1990-05-06",
        "birthCountry": "Venezuela",
        "birthStateProvince": None,
        "height": "5' 6\"",
        "weight": 166,
        "currentTeam": {"id": 117},
        "primaryPosition": {"abbreviation": "2B"},
        "batSide": {"code": "R"},
        "pitchHand": {"code": "R"},
    }
    row = person_to_player_row(person, {117: "HOU"})
    assert row is not None
    assert row["player_id"] == 123
    assert row["team"] == "HOU"
    assert row["height_feet"] == 5
    assert row["height_inches"] == 6


def test_replace_pitches_for_dates_idempotent(app):
    rows = parse_csv(SAMPLE_CSV.encode("utf-8"))
    with app.app_context():
        s1 = replace_pitches_for_dates(rows, date(2026, 7, 1), date(2026, 7, 1))
        assert s1["inserted"] == 1
        s2 = replace_pitches_for_dates(rows, date(2026, 7, 1), date(2026, 7, 1))
        assert s2["deleted"] == 1
        assert s2["inserted"] == 1
        assert Pitch.query.filter_by(game_date="2026-07-01").count() == 1


def test_upsert_players(app):
    with app.app_context():
        stats = upsert_players(
            [
                dict(
                    player_id=99,
                    first_name="Test",
                    last_name="Player",
                    birthdate="2000-01-01",
                    birth_country="USA",
                    birth_state="TX",
                    height_feet=6,
                    height_inches=0,
                    weight=200,
                    team="HOU",
                    primary_position="P",
                    throws="R",
                    bats="R",
                )
            ]
        )
        assert stats["inserted"] == 1
        assert db.session.get(Player, 99) is not None
        stats2 = upsert_players(
            [
                dict(
                    player_id=99,
                    first_name="Test",
                    last_name="Player",
                    birthdate="2000-01-01",
                    birth_country="USA",
                    birth_state="TX",
                    height_feet=6,
                    height_inches=1,
                    weight=205,
                    team="NYY",
                    primary_position="P",
                    throws="R",
                    bats="R",
                )
            ]
        )
        assert stats2["updated"] == 1
        assert db.session.get(Player, 99).team == "NYY"
