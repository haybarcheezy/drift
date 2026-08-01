// Domain types mirroring the backend API responses.

export interface Player {
  player_id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  birth_country: string | null;
  birth_state: string | null;
  height_feet: number;
  height_inches: number;
  weight: number;
  team: string;
  primary_position: string;
  throws: string;
  bats: string;
}

export interface Pitch {
  rowid: number;
  pitch_type: string | null;
  pitch_name: string | null;
  game_date: string;
  player_name: string | null;
  pitcher: number;
  batter: number;
  release_speed: number | null;
  release_spin_rate: number | null;
  release_pos_x: number | null;
  release_pos_y: number | null;
  release_pos_z: number | null;
  effective_speed: number | null;
  spin_axis: number | null;
  vx0: number | null;
  vy0: number | null;
  vz0: number | null;
  ax: number | null;
  ay: number | null;
  az: number | null;
  pfx_x: number | null;
  pfx_z: number | null;
  plate_x: number | null;
  plate_z: number | null;
  zone: number | null;
  sz_top: number | null;
  sz_bot: number | null;
  game_pk: number | null;
  at_bat_number: number | null;
  pitch_number: number | null;
  type: string | null;
  description: string | null;
  events: string | null;
  balls: number | null;
  strikes: number | null;
  outs_when_up: number | null;
  inning: number | null;
  inning_topbot: string | null;
  launch_speed: number | null;
  launch_angle: number | null;
  hit_distance_sc: number | null;
  stand: string | null;
  p_throws: string | null;
  home_team: string | null;
  away_team: string | null;
}

/** One sample along a reconstructed flight path (Statcast feet). */
export interface FlightSample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface FlightPath {
  mode: "kinematic" | "linear_fallback";
  t_plate: number;
  samples: FlightSample[];
  tunnel: FlightSample;
  plate: { x: number | null; z: number | null };
}

export interface PitchFlightResponse {
  pitch: Pitch;
  flight: FlightPath;
}

export interface AtBatResponse {
  game_pk: number;
  at_bat_number: number;
  pitcher: number;
  batter: number;
  game_date: string;
  pitches: PitchFlightResponse[];
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface PlayerFilterOptions {
  team?: string;
  position?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface PitchFilterOptions {
  pitcher?: number;
  batter?: number;
  player_id?: number;
  pitch_type?: string;
  team?: string;
  min_velocity?: number;
  max_velocity?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  per_page?: number;
}

export interface PitchType {
  code: string;
  name: string;
}

export interface ArsenalEntry {
  pitch_type: string;
  pitch_name: string | null;
  count: number;
  usage_pct: number;
  avg_velocity: number | null;
  max_velocity: number | null;
  avg_spin_rate: number | null;
}

export interface ArsenalResponse {
  player: Player;
  total_pitches: number;
  arsenal: ArsenalEntry[];
}
