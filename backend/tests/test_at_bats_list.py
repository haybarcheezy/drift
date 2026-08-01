"""Tests for paginated at-bat list endpoint."""


def test_list_at_bats_requires_pitcher_or_batter(client):
    res = client.get("/api/at-bats")
    assert res.status_code == 400


def test_list_at_bats_by_pitcher(client):
    res = client.get("/api/at-bats?pitcher=2")
    assert res.status_code == 200
    body = res.get_json()
    assert "data" in body and "pagination" in body
    assert body["pagination"]["total"] >= 1
    ab = body["data"][0]
    assert ab["pitcher"] == 2
    assert ab["pitch_count"] >= 1
    assert ab["first_pitch_rowid"]
    assert isinstance(ab["pitch_types"], list)
    assert isinstance(ab["pitches"], list)
    assert ab["pitches"][0]["rowid"] == ab["first_pitch_rowid"]


def test_list_at_bats_matchup(client):
    res = client.get("/api/at-bats?pitcher=2&batter=3")
    assert res.status_code == 200
    body = res.get_json()
    assert body["pagination"]["total"] >= 1
    for ab in body["data"]:
        assert ab["pitcher"] == 2
        assert ab["batter"] == 3


def test_list_at_bats_by_batter(client):
    res = client.get("/api/at-bats?batter=3")
    assert res.status_code == 200
    body = res.get_json()
    assert body["pagination"]["total"] >= 1
    for ab in body["data"]:
        assert ab["batter"] == 3
