"""Unit tests for Statcast trajectory reconstruction."""

import pytest

from app.physics.trajectory import (
    flight_from_pitch_fields,
    plate_time,
    sample_trajectory,
    tunnel_point,
)

# Scherzer SL 2025-11-01 from baseball.db (real Statcast kinematics)
KIN = dict(
    release_pos_x=-3.1,
    release_pos_y=54.54,
    release_pos_z=5.64,
    vx0=6.729223103416219,
    vy0=-124.956206359765,
    vz0=-0.9360903545503939,
    ax=0.6995300593399232,
    ay=26.677875920900142,
    az=-32.402977442071844,
)
PLATE = dict(plate_x=-0.07, plate_z=2.57)


def test_plate_time_positive_and_short():
    t = plate_time(**KIN)
    assert 0.3 < t < 0.6


def test_path_ends_near_measured_plate():
    flight = sample_trajectory(**KIN, n=80, plate_x=PLATE["plate_x"], plate_z=PLATE["plate_z"])
    last = flight["samples"][-1]
    assert abs(last["x"] - PLATE["plate_x"]) < 0.25
    assert abs(last["z"] - PLATE["plate_z"]) < 0.25
    assert flight["mode"] == "kinematic"
    assert flight["t_plate"] == pytest.approx(plate_time(**KIN), rel=1e-6)


def test_tunnel_at_150ms():
    p = tunnel_point(**KIN, t=0.15)
    assert p["t"] == 0.15
    assert p["y"] < KIN["release_pos_y"]
    assert p["y"] > 1.417


def test_sample_count():
    flight = sample_trajectory(**KIN, n=40)
    assert len(flight["samples"]) == 40
    assert flight["samples"][0]["t"] == 0.0


def test_flight_from_pitch_fields_kinematic():
    fields = {**KIN, **PLATE}
    # Simulate TEXT columns from SQLite
    text_fields = {k: str(v) for k, v in fields.items()}
    flight = flight_from_pitch_fields(text_fields)
    assert flight["mode"] == "kinematic"
    assert len(flight["samples"]) == 80


def test_flight_from_pitch_fields_fallback():
    fields = {
        "release_pos_x": -2.0,
        "release_pos_z": 5.5,
        "plate_x": 0.1,
        "plate_z": 2.4,
    }
    flight = flight_from_pitch_fields(fields)
    assert flight["mode"] == "linear_fallback"
    assert flight["samples"][-1]["x"] == pytest.approx(0.1)
    assert flight["samples"][-1]["z"] == pytest.approx(2.4)


def test_flight_from_pitch_fields_insufficient():
    with pytest.raises(ValueError, match="insufficient"):
        flight_from_pitch_fields({"release_pos_x": -1.0})
