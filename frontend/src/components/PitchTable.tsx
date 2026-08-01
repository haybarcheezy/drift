import React from "react";
import { Pitch } from "../types";

interface PitchTableProps {
  pitches: Pitch[];
  isLoading?: boolean;
  error?: string;
  totalCount?: number;
  onSelectPitch?: (pitch: Pitch) => void;
  selectedRowid?: number | null;
}

const PitchTable: React.FC<PitchTableProps> = ({
  pitches,
  isLoading = false,
  error,
  totalCount,
  onSelectPitch,
  selectedRowid,
}) => {
  if (isLoading) {
    return (
      <div className="pitch-table">
        <div className="loading">Loading pitches...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pitch-table">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  if (pitches.length === 0) {
    return (
      <div className="pitch-table">
        <div className="no-data">No pitches found.</div>
      </div>
    );
  }

  return (
    <div className="pitch-table">
      <h2>Pitches ({totalCount ?? pitches.length})</h2>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Pitcher</th>
              <th>Type</th>
              <th>Velo</th>
              <th>Spin</th>
              <th>Count</th>
              <th>Inning</th>
              <th>Result</th>
              <th>Event</th>
              <th>Game</th>
            </tr>
          </thead>
          <tbody>
            {pitches.map((pitch) => (
              <tr
                key={pitch.rowid}
                className={selectedRowid === pitch.rowid ? "selected" : undefined}
                onClick={() => onSelectPitch?.(pitch)}
                title="Open pitch flight theater"
              >
                <td>{pitch.game_date}</td>
                <td>{pitch.player_name ?? pitch.pitcher}</td>
                <td title={pitch.pitch_name ?? undefined}>
                  {pitch.pitch_type ?? "-"}
                </td>
                <td>
                  {pitch.release_speed != null
                    ? `${pitch.release_speed.toFixed(1)} mph`
                    : "-"}
                </td>
                <td>
                  {pitch.release_spin_rate != null
                    ? `${Math.round(pitch.release_spin_rate)} rpm`
                    : "-"}
                </td>
                <td>
                  {pitch.balls ?? "-"}-{pitch.strikes ?? "-"}
                </td>
                <td>
                  {pitch.inning_topbot === "Top" ? "▲" : "▼"} {pitch.inning}
                </td>
                <td>{pitch.description ?? "-"}</td>
                <td>{pitch.events ?? ""}</td>
                <td>
                  {pitch.away_team} @ {pitch.home_team}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PitchTable;
