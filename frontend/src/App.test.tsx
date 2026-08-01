import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import App from "./App";
import ApiService from "./services/api";

vi.mock("./services/api", () => ({
  default: {
    getPlayers: vi.fn(),
    getTeams: vi.fn(),
    getPositions: vi.fn(),
    getPitchTypes: vi.fn(),
    getPitches: vi.fn(),
    getPitchFlight: vi.fn(),
    getAtBat: vi.fn(),
    listAtBats: vi.fn(),
  },
}));

vi.mock("./components/theater/PitchTheater", () => ({
  default: ({ rowid }: { rowid: number }) => (
    <div data-testid="pitch-theater">Theater for pitch {rowid}</div>
  ),
}));

const mocked = vi.mocked(ApiService, true);

const samplePitch = {
  rowid: 42,
  pitch_type: "FF",
  pitch_name: "4-Seam Fastball",
  game_date: "2026-07-01",
  player_name: "Wheeler, Zack",
  pitcher: 554430,
  batter: 1,
  release_speed: 96.4,
  release_spin_rate: 2400,
  release_pos_x: null,
  release_pos_y: null,
  release_pos_z: null,
  effective_speed: null,
  spin_axis: null,
  vx0: null,
  vy0: null,
  vz0: null,
  ax: null,
  ay: null,
  az: null,
  pfx_x: null,
  pfx_z: null,
  plate_x: null,
  plate_z: null,
  zone: null,
  sz_top: null,
  sz_bot: null,
  game_pk: 1,
  at_bat_number: 1,
  pitch_number: 1,
  type: "S",
  description: "called_strike",
  events: null,
  balls: 0,
  strikes: 0,
  outs_when_up: 0,
  inning: 1,
  inning_topbot: "Top",
  launch_speed: null,
  launch_angle: null,
  hit_distance_sc: null,
  stand: "R",
  p_throws: "R",
  home_team: "PHI",
  away_team: "NYY",
};

beforeEach(() => {
  mocked.getTeams.mockResolvedValue(["PHI", "HOU"]);
  mocked.getPositions.mockResolvedValue(["P"]);
  mocked.getPitchTypes.mockResolvedValue([{ code: "FF", name: "4-Seam" }]);
  mocked.getPitches.mockResolvedValue({
    data: [samplePitch],
    pagination: { page: 1, per_page: 32, total: 1, total_pages: 1 },
  });
  mocked.getPlayers.mockResolvedValue({
    data: [],
    pagination: { page: 1, per_page: 12, total: 0, total_pages: 0 },
  });
  mocked.listAtBats.mockResolvedValue({
    data: [],
    pagination: { page: 1, per_page: 20, total: 0, total_pages: 0 },
  });
  mocked.getPitchFlight.mockResolvedValue({
    pitch: samplePitch,
    flight: {
      mode: "kinematic",
      t_plate: 0.4,
      samples: [
        { t: 0, x: 0, y: 55, z: 6 },
        { t: 0.4, x: 0, y: 1.4, z: 2.5 },
      ],
      tunnel: { t: 0.15, x: 0, y: 40, z: 5 },
      plate: { x: 0, z: 2.5 },
    },
  });
});

describe("App", () => {
  it("boots theater and side rails", async () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /^drift$/i })
    ).toBeInTheDocument();
    expect(await screen.findByTestId("pitch-theater")).toHaveTextContent(
      "Theater for pitch 42"
    );
    expect(screen.getByLabelText(/pitcher browser/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/batter browser/i)).toBeInTheDocument();
    expect(await screen.findByText(/Wheeler, Zack/i)).toBeInTheDocument();
  });

  it("shows an error when the pitch slice fails", async () => {
    mocked.getPitches.mockRejectedValueOnce(new Error("network"));
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getAllByText(/could not load pitch slice/i).length
      ).toBeGreaterThan(0);
    });
  });
});
