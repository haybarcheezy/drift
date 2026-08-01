"""Tests for pitch flight and at-bat theater endpoints."""


def test_flight_kinematic(client):
    # First seeded pitch has full kinematics
    res = client.get("/api/pitches/1/flight")
    assert res.status_code == 200
    body = res.get_json()
    assert "pitch" in body and "flight" in body
    assert body["flight"]["mode"] == "kinematic"
    assert len(body["flight"]["samples"]) >= 40
    assert body["flight"]["tunnel"]["t"] == 0.15
    assert body["pitch"]["pitch_type"] == "SI"


def test_flight_linear_fallback(client):
    # Third pitch: release + plate only
    res = client.get("/api/pitches/3/flight")
    assert res.status_code == 200
    body = res.get_json()
    assert body["flight"]["mode"] == "linear_fallback"


def test_flight_insufficient_data(client):
    res = client.get("/api/pitches/4/flight")
    assert res.status_code == 422
    assert "insufficient" in res.get_json()["error"].lower()


def test_flight_not_found(client):
    res = client.get("/api/pitches/99999/flight")
    assert res.status_code == 404


def test_at_bat_with_flights(client):
    res = client.get("/api/games/700001/at-bats/3")
    assert res.status_code == 200
    body = res.get_json()
    assert body["game_pk"] == 700001
    assert body["at_bat_number"] == 3
    assert len(body["pitches"]) == 2
    assert body["pitches"][0]["flight"]["mode"] == "kinematic"
    assert body["pitches"][1]["flight"]["mode"] == "kinematic"
    # Ordered by pitch_number
    assert body["pitches"][0]["pitch"]["pitch_number"] == 1
    assert body["pitches"][1]["pitch"]["pitch_number"] == 2


def test_at_bat_not_found(client):
    res = client.get("/api/games/1/at-bats/999")
    assert res.status_code == 404
