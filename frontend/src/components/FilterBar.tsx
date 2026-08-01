import type { PitchFilterOptions, PitchType } from "../types";

interface FilterBarProps {
  filters: PitchFilterOptions;
  pitchTypes: PitchType[];
  teams: string[];
  onChange: (next: PitchFilterOptions) => void;
  total?: number;
}

export default function FilterBar({
  filters,
  pitchTypes,
  teams,
  onChange,
  total,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <label className="filter-pill">
        <span>Type</span>
        <select
          value={filters.pitch_type ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              pitch_type: e.target.value || undefined,
              page: 1,
            })
          }
        >
          <option value="">All</option>
          {pitchTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-pill">
        <span>Team</span>
        <select
          value={filters.team ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              team: e.target.value || undefined,
              page: 1,
            })
          }
        >
          <option value="">All</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-pill">
        <span>Min mph</span>
        <input
          type="number"
          min={70}
          max={110}
          step={1}
          placeholder="any"
          value={filters.min_velocity ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              min_velocity: e.target.value
                ? Number(e.target.value)
                : undefined,
              page: 1,
            })
          }
        />
      </label>

      <button
        type="button"
        className="filter-pill filter-pill--action"
        onClick={() =>
          onChange({
            min_velocity: 95,
            page: 1,
            per_page: 32,
          })
        }
      >
        95+ heat
      </button>

      <button
        type="button"
        className="filter-pill filter-pill--ghost"
        onClick={() =>
          onChange({
            min_velocity: 88,
            page: 1,
            per_page: 36,
          })
        }
      >
        Reset slice
      </button>

      {total != null && (
        <span className="filter-count">
          <strong>{total.toLocaleString()}</strong> in view
        </span>
      )}
    </div>
  );
}
