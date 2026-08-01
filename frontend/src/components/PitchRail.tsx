import type { Pitch } from "../types";
import { colorForPitchType } from "./theater/pitchColors";

interface PitchRailProps {
  pitches: Pitch[];
  activeRowid: number | null;
  loading?: boolean;
  onSelect: (pitch: Pitch) => void;
}

export default function PitchRail({
  pitches,
  activeRowid,
  loading,
  onSelect,
}: PitchRailProps) {
  if (loading) {
    return (
      <div className="pitch-rail" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="pitch-card pitch-card--skeleton" />
        ))}
      </div>
    );
  }

  if (pitches.length === 0) {
    return (
      <div className="pitch-rail pitch-rail--empty">
        <p>No pitches in this slice. Adjust filters or re-run ingest.</p>
      </div>
    );
  }

  return (
    <div className="pitch-rail" role="list">
      {pitches.map((pitch) => {
        const color = colorForPitchType(pitch.pitch_type);
        const active = pitch.rowid === activeRowid;
        return (
          <button
            key={pitch.rowid}
            type="button"
            role="listitem"
            className={active ? "pitch-card active" : "pitch-card"}
            style={{ ["--pitch-color" as string]: color }}
            onClick={() => onSelect(pitch)}
          >
            <div className="pitch-card-top">
              <span className="pitch-card-type">{pitch.pitch_type ?? "-"}</span>
              <span className="pitch-card-velo">
                {pitch.release_speed != null
                  ? `${pitch.release_speed.toFixed(1)}`
                  : "-"}
                <small>mph</small>
              </span>
            </div>
            <div className="pitch-card-name">
              {pitch.player_name ?? `ID ${pitch.pitcher}`}
            </div>
            <div className="pitch-card-meta">
              <span>
                {pitch.away_team}/{pitch.home_team}
              </span>
              <span>
                {pitch.balls ?? 0}-{pitch.strikes ?? 0}
              </span>
              {pitch.release_spin_rate != null && (
                <span>{Math.round(pitch.release_spin_rate)} rpm</span>
              )}
            </div>
            <div className="pitch-card-bar" />
          </button>
        );
      })}
    </div>
  );
}
