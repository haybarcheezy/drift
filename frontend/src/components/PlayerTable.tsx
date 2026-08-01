import React from "react";
import { Player } from "../types";

interface PlayerTableProps {
  players: Player[];
  isLoading?: boolean;
  error?: string;
  totalCount?: number;
  onSelectPlayer?: (player: Player) => void;
  selectedPlayerId?: number;
}

const formatHeight = (feet: number, inches: number) => `${feet}'${inches}"`;

const PlayerTable: React.FC<PlayerTableProps> = ({
  players,
  isLoading = false,
  error,
  totalCount,
  onSelectPlayer,
  selectedPlayerId,
}) => {
  if (isLoading) {
    return (
      <div className="player-table">
        <div className="loading">Loading players...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="player-table">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="player-table">
        <div className="no-data">No players found.</div>
      </div>
    );
  }

  return (
    <div className="player-table">
      <h2>Players ({totalCount ?? players.length})</h2>
      <p className="hint">Click a row to view a player's pitch arsenal.</p>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Position</th>
              <th>B/T</th>
              <th>Height</th>
              <th>Weight</th>
              <th>Born</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr
                key={player.player_id}
                onClick={() => onSelectPlayer?.(player)}
                className={
                  player.player_id === selectedPlayerId ? "selected-row" : ""
                }
                style={{ cursor: onSelectPlayer ? "pointer" : undefined }}
              >
                <td>
                  {player.last_name}, {player.first_name}
                </td>
                <td>{player.team}</td>
                <td>{player.primary_position}</td>
                <td>
                  {player.bats}/{player.throws}
                </td>
                <td>{formatHeight(player.height_feet, player.height_inches)}</td>
                <td>{player.weight} lb</td>
                <td>
                  {player.birthdate}
                  {player.birth_country ? ` · ${player.birth_country}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerTable;
