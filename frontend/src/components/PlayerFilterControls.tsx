import React, { ChangeEvent, useState } from "react";
import { PlayerFilterOptions } from "../types";

interface PlayerFilterControlsProps {
  onFilterChange: (filters: PlayerFilterOptions) => void;
  availableTeams?: string[];
  availablePositions?: string[];
}

const PlayerFilterControls: React.FC<PlayerFilterControlsProps> = ({
  onFilterChange,
  availableTeams = [],
  availablePositions = [],
}) => {
  const [filters, setFilters] = useState<PlayerFilterOptions>({});

  const update = (patch: Partial<PlayerFilterOptions>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  const handleTeamChange = (event: ChangeEvent<HTMLSelectElement>) =>
    update({ team: event.target.value || undefined });

  const handlePositionChange = (event: ChangeEvent<HTMLSelectElement>) =>
    update({ position: event.target.value || undefined });

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) =>
    update({ search: event.target.value || undefined });

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  return (
    <div className="filter-controls">
      <h3>Filter Players</h3>

      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="team-filter">Team:</label>
          <select
            id="team-filter"
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
          <label htmlFor="position-filter">Position:</label>
          <select
            id="position-filter"
            value={filters.position || ""}
            onChange={handlePositionChange}
          >
            <option value="">All Positions</option>
            {availablePositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="name-search">Name:</label>
          <input
            id="name-search"
            type="text"
            placeholder="Search by name..."
            value={filters.search || ""}
            onChange={handleSearchChange}
          />
        </div>

        <button onClick={clearFilters} className="clear-filters">
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default PlayerFilterControls;
