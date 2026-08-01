import axios from "axios";
import {
  ArsenalResponse,
  AtBatListFilters,
  AtBatResponse,
  AtBatSummary,
  Paginated,
  Pitch,
  PitchFilterOptions,
  PitchFlightResponse,
  PitchType,
  Player,
  PlayerFilterOptions,
} from "../types";

// Requests go through the Vite dev-server proxy (/api -> Flask on :5001).
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

/** Strip undefined/empty values so they don't appear as ?team=&search= */
const cleanParams = (params?: object) =>
  Object.fromEntries(
    Object.entries(params ?? {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );

export class ApiService {
  static async getPlayers(
    filters?: PlayerFilterOptions
  ): Promise<Paginated<Player>> {
    const { data } = await api.get<Paginated<Player>>("/players", {
      params: cleanParams(filters),
    });
    return data;
  }

  static async getPlayer(playerId: number): Promise<Player> {
    const { data } = await api.get<Player>(`/players/${playerId}`);
    return data;
  }

  static async getTeams(): Promise<string[]> {
    const { data } = await api.get<string[]>("/players/teams");
    return data;
  }

  static async getPositions(): Promise<string[]> {
    const { data } = await api.get<string[]>("/players/positions");
    return data;
  }

  static async getArsenal(playerId: number): Promise<ArsenalResponse> {
    const { data } = await api.get<ArsenalResponse>(
      `/players/${playerId}/arsenal`
    );
    return data;
  }

  static async getPitches(
    filters?: PitchFilterOptions
  ): Promise<Paginated<Pitch>> {
    const { data } = await api.get<Paginated<Pitch>>("/pitches", {
      params: cleanParams(filters),
    });
    return data;
  }

  static async getPitchTypes(): Promise<PitchType[]> {
    const { data } = await api.get<PitchType[]>("/pitches/types");
    return data;
  }

  static async getPitchFlight(rowid: number): Promise<PitchFlightResponse> {
    const { data } = await api.get<PitchFlightResponse>(
      `/pitches/${rowid}/flight`
    );
    return data;
  }

  static async getAtBat(
    gamePk: number,
    atBatNumber: number
  ): Promise<AtBatResponse> {
    const { data } = await api.get<AtBatResponse>(
      `/games/${gamePk}/at-bats/${atBatNumber}`
    );
    return data;
  }

  static async listAtBats(
    filters: AtBatListFilters
  ): Promise<Paginated<AtBatSummary>> {
    const { data } = await api.get<Paginated<AtBatSummary>>("/at-bats", {
      params: cleanParams(filters),
    });
    return data;
  }

  static async healthCheck(): Promise<{ status: string }> {
    const { data } = await axios.get<{ status: string }>("/health");
    return data;
  }
}

export default ApiService;
