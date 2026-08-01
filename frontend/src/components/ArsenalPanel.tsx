import React, { useEffect, useState } from "react";
import ApiService from "../services/api";
import { ArsenalResponse } from "../types";

interface ArsenalPanelProps {
  playerId: number;
  onClose: () => void;
}

/**
 * Pitch arsenal summary for a selected player: usage %, velocity, and spin
 * by pitch type. Position players simply show zero pitches thrown.
 */
const ArsenalPanel: React.FC<ArsenalPanelProps> = ({ playerId, onClose }) => {
  const [arsenal, setArsenal] = useState<ArsenalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    ApiService.getArsenal(playerId)
      .then((data) => {
        if (!cancelled) setArsenal(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load arsenal data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return (
    <div className="arsenal-panel">
      <div className="arsenal-header">
        <h3>
          {arsenal
            ? `${arsenal.player.first_name} ${arsenal.player.last_name} - Pitch Arsenal`
            : "Pitch Arsenal"}
        </h3>
        <button onClick={onClose} aria-label="Close arsenal panel">
          ✕
        </button>
      </div>

      {isLoading && <div className="loading">Loading arsenal...</div>}
      {error && <div className="error">Error: {error}</div>}

      {arsenal && !isLoading && !error && (
        <>
          {arsenal.total_pitches === 0 ? (
            <div className="no-data">
              No pitches thrown - likely a position player.
            </div>
          ) : (
            <>
              <p className="hint">
                {arsenal.total_pitches.toLocaleString()} pitches thrown in the
                2025 postseason
              </p>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Pitch</th>
                      <th>Usage</th>
                      <th>Count</th>
                      <th>Avg Velo</th>
                      <th>Max Velo</th>
                      <th>Avg Spin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arsenal.arsenal.map((entry) => (
                      <tr key={entry.pitch_type}>
                        <td>
                          <strong>{entry.pitch_type}</strong>
                          {entry.pitch_name ? ` - ${entry.pitch_name}` : ""}
                        </td>
                        <td>
                          <div className="usage-bar-wrap">
                            <div
                              className="usage-bar"
                              style={{ width: `${entry.usage_pct}%` }}
                            />
                            <span>{entry.usage_pct}%</span>
                          </div>
                        </td>
                        <td>{entry.count}</td>
                        <td>
                          {entry.avg_velocity != null
                            ? `${entry.avg_velocity} mph`
                            : "-"}
                        </td>
                        <td>
                          {entry.max_velocity != null
                            ? `${entry.max_velocity} mph`
                            : "-"}
                        </td>
                        <td>
                          {entry.avg_spin_rate != null
                            ? `${entry.avg_spin_rate} rpm`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ArsenalPanel;
