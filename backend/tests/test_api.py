"""API tests for health and player endpoints."""


class TestHealthCheck:
    """Test the health check endpoint."""

    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.get_json() == {"status": "healthy"}


class TestPlayerAPI:
    """Test player-related API endpoints."""

    def test_get_all_players(self, client):
        resp = client.get("/api/players")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["pagination"]["total"] == 3
        assert len(body["data"]) == 3
        # Sorted by last name: Altuve, Ohtani, Valdez
        assert [p["last_name"] for p in body["data"]] == ["Altuve", "Ohtani", "Valdez"]

    def test_filter_players_by_team(self, client):
        resp = client.get("/api/players?team=HOU")
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["pagination"]["total"] == 2
        assert all(p["team"] == "HOU" for p in body["data"])

    def test_filter_players_by_team_is_case_insensitive(self, client):
        resp = client.get("/api/players?team=hou")
        assert resp.get_json()["pagination"]["total"] == 2

    def test_filter_players_by_position(self, client):
        resp = client.get("/api/players?position=2B")
        body = resp.get_json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["last_name"] == "Altuve"

    def test_search_players_by_name(self, client):
        resp = client.get("/api/players?search=ohta")
        body = resp.get_json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["last_name"] == "Ohtani"

    def test_players_pagination(self, client):
        resp = client.get("/api/players?page=2&per_page=2")
        body = resp.get_json()
        assert len(body["data"]) == 1
        assert body["pagination"] == {
            "page": 2,
            "per_page": 2,
            "total": 3,
            "total_pages": 2,
        }

    def test_invalid_query_param_returns_400(self, client):
        resp = client.get("/api/players?page=0")
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_get_player_by_id(self, client):
        resp = client.get("/api/players/1")
        assert resp.status_code == 200
        assert resp.get_json()["last_name"] == "Altuve"

    def test_get_nonexistent_player(self, client):
        resp = client.get("/api/players/999")
        assert resp.status_code == 404
        assert "error" in resp.get_json()

    def test_get_teams(self, client):
        resp = client.get("/api/players/teams")
        assert resp.status_code == 200
        assert resp.get_json() == ["HOU", "LAD"]

    def test_get_positions(self, client):
        resp = client.get("/api/players/positions")
        assert resp.status_code == 200
        assert resp.get_json() == ["2B", "DH", "LHS"]


class TestPitchAPI:
    """Test pitch-related API endpoints."""

    def test_get_all_pitches(self, client):
        resp = client.get("/api/pitches")
        assert resp.status_code == 200
        assert resp.get_json()["pagination"]["total"] == 4

    def test_numeric_fields_are_serialized_as_numbers(self, client):
        """The DB stores numerics as TEXT; API must return real JSON numbers."""
        body = client.get("/api/pitches?pitcher=2&pitch_type=SI").get_json()
        pitch = body["data"][0]
        assert isinstance(pitch["release_speed"], float)
        assert isinstance(pitch["balls"], int)

    def test_blank_velocity_serialized_as_null(self, client):
        body = client.get("/api/pitches?batter=1").get_json()
        assert body["data"][0]["release_speed"] is None

    def test_filter_pitches_thrown_by_player(self, client):
        body = client.get("/api/pitches?pitcher=2").get_json()
        assert body["pagination"]["total"] == 4

    def test_filter_pitches_seen_by_player(self, client):
        body = client.get("/api/pitches?batter=3").get_json()
        assert body["pagination"]["total"] == 3

    def test_filter_pitches_thrown_or_seen(self, client):
        body = client.get("/api/pitches?player_id=1").get_json()
        assert body["pagination"]["total"] == 1  # Altuve only saw one pitch

    def test_filter_by_pitch_type(self, client):
        body = client.get("/api/pitches?pitch_type=CU").get_json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["pitch_type"] == "CU"

    def test_filter_by_min_velocity_casts_text_column(self, client):
        """95+ mph filter must CAST the TEXT column - the assessment's own
        example question ('what pitches were thrown at 95 mph or greater?')."""
        body = client.get("/api/pitches?min_velocity=95").get_json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["release_speed"] == 95.3

    def test_filter_by_velocity_range(self, client):
        body = client.get("/api/pitches?min_velocity=79&max_velocity=95").get_json()
        assert body["pagination"]["total"] == 2

    def test_filter_by_date_range(self, client):
        body = client.get(
            "/api/pitches?start_date=2025-10-02&end_date=2025-10-02"
        ).get_json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["game_date"] == "2025-10-02"

    def test_filter_by_team(self, client):
        body = client.get("/api/pitches?team=LAD").get_json()
        assert body["pagination"]["total"] == 4  # all seed games involve LAD

    def test_invalid_velocity_returns_400(self, client):
        resp = client.get("/api/pitches?min_velocity=not-a-number")
        assert resp.status_code == 400

    def test_get_pitch_types(self, client):
        resp = client.get("/api/pitches/types")
        assert resp.status_code == 200
        codes = [t["code"] for t in resp.get_json()]
        assert codes == ["CU", "FF", "SI"]


class TestArsenalAPI:
    """Test the pitcher arsenal summary endpoint."""

    def test_arsenal_aggregates_by_pitch_type(self, client):
        resp = client.get("/api/players/2/arsenal")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["player"]["last_name"] == "Valdez"
        assert body["total_pitches"] == 4

        by_type = {a["pitch_type"]: a for a in body["arsenal"]}
        assert by_type["SI"]["count"] == 2
        assert by_type["SI"]["usage_pct"] == 50.0
        assert by_type["SI"]["avg_velocity"] == 94.7
        assert by_type["SI"]["max_velocity"] == 95.3
        assert by_type["CU"]["avg_spin_rate"] == 2800

    def test_arsenal_sorted_by_usage(self, client):
        body = client.get("/api/players/2/arsenal").get_json()
        counts = [a["count"] for a in body["arsenal"]]
        assert counts == sorted(counts, reverse=True)

    def test_arsenal_for_nonexistent_player_returns_404(self, client):
        assert client.get("/api/players/999/arsenal").status_code == 404

    def test_arsenal_for_position_player_is_empty(self, client):
        body = client.get("/api/players/3/arsenal").get_json()
        assert body["total_pitches"] == 0
        assert body["arsenal"] == []
