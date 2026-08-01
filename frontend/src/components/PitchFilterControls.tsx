import React, { ChangeEvent, useState } from "react";
import { PitchFilterOptions, PitchType } from "../types";

interface PitchFilterControlsProps {
  onFilterChange: (filters: PitchFilterOptions) => void;
  availablePitchTypes?: PitchType[];
  availableTeams?: string[];
}

const PitchFilterControls: React.FC<PitchFilterControlsProps> = ({
  onFilterChange,
  availablePitchTypes = [],
  availableTeams = [],
}) => {
  const [filters, setFilters] = useState<PitchFilterOptions>({});

  const update = (patch: Partial<PitchFilterOptions>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  const handlePitchTypeChange = (event: ChangeEvent<HTMLSelectElement>) =>
    update({ pitch_type: event.target.value || undefined });

  const handleTeamChange = (event: ChangeEvent<HTMLSelectElement>) =>
    update({ team: event.target.value || undefined });

  const handleMinVeloChange = (event: ChangeEvent<HTMLInputElement>) =>
    update({
      min_velocity: event.target.value ? Number(event.target.value) : undefined,
    });

  const handleMaxVeloChange = (event: ChangeEvent<HTMLInputElement>) =>
    update({
      max_velocity: event.target.value ? Number(event.target.value) : undefined,
    });

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  return (
    <div className="filter-controls">
      <h3>Filter Pitches</h3>

      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="pitch-type-filter">Pitch Type:</label>
          <select
            id="pitch-type-filter"
            value={filters.pitch_type || ""}
            onChange={handlePitchTypeChange}
          >
            <option value="">All Types</option>
            {availablePitchTypes.map((pt) => (
              <option key={pt.code} value={pt.code}>
                {pt.code} - {pt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="pitch-team-filter">Team:</label>
          <select
            id="pitch-team-filter"
            value={filters.team || ""}
            onChange={handleTeamChange}
          >
            <option value="">All Teams</option>
            {availableTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="min-velo">Min Velo (mph):</label>
          <input
            id="min-velo"
            type="number"
            min={0}
            max={110}
            placeholder="e.g. 95"
            value={filters.min_velocity ?? ""}
            onChange={handleMinVeloChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="max-velo">Max Velo (mph):</label>
          <input
            id="max-velo"
            type="number"
            min={0}
            max={110}
            value={filters.max_velocity ?? ""}
            onChange={handleMaxVeloChange}
          />
        </div>

        <button onClick={clearFilters} className="clear-filters">
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default PitchFilterControls;
