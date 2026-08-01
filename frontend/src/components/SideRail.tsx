import { useCallback, useEffect, useRef, useState } from "react";
import ApiService from "../services/api";
import type { AtBatSummary, Player } from "../types";
import { colorForPitchType } from "./theater/pitchColors";

export type RailRole = "pitcher" | "batter";

interface SideRailProps {
  role: RailRole;
  /** Optional locked opponent id for matchup mode. */
  matchupPlayerId?: number | null;
  selectedPlayerId: number | null;
  activeRowid: number | null;
  onSelectPlayer: (player: Player | null) => void;
  onSelectPitch: (rowid: number) => void;
  /** Mobile drawer open state (desktop ignores). */
  open?: boolean;
  onClose?: () => void;
}

const DEBOUNCE_MS = 280;

export default function SideRail({
  role,
  matchupPlayerId,
  selectedPlayerId,
  activeRowid,
  onSelectPlayer,
  onSelectPitch,
  open = true,
  onClose,
}: SideRailProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const [atBats, setAtBats] = useState<AtBatSummary[]>([]);
  const [abLoading, setAbLoading] = useState(false);
  const [abError, setAbError] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [abPage, setAbPage] = useState(1);
  const [abTotalPages, setAbTotalPages] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const title = role === "pitcher" ? "Pitcher" : "Batter";
  const placeholder =
    role === "pitcher" ? "Search pitcher…" : "Search batter…";

  // Debounced player search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      ApiService.getPlayers({
        search: query.trim(),
        per_page: 12,
        page: 1,
      })
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Sync selected player when parent clears
  useEffect(() => {
    if (selectedPlayerId == null) {
      setSelected(null);
      setAtBats([]);
      setExpandedKey(null);
    }
  }, [selectedPlayerId]);

  const loadAtBats = useCallback(
    (playerId: number, page: number) => {
      setAbLoading(true);
      setAbError("");
      const filters =
        role === "pitcher"
          ? {
              pitcher: playerId,
              batter: matchupPlayerId ?? undefined,
              page,
              per_page: 20,
            }
          : {
              batter: playerId,
              pitcher: matchupPlayerId ?? undefined,
              page,
              per_page: 20,
            };
      ApiService.listAtBats(filters)
        .then((res) => {
          setAtBats(res.data);
          setAbPage(res.pagination.page);
          setAbTotalPages(res.pagination.total_pages);
        })
        .catch(() => {
          setAbError("Could not load at-bats.");
          setAtBats([]);
        })
        .finally(() => setAbLoading(false));
    },
    [role, matchupPlayerId]
  );

  useEffect(() => {
    if (selected?.player_id) {
      loadAtBats(selected.player_id, 1);
    }
  }, [selected?.player_id, matchupPlayerId, loadAtBats]);

  const pickPlayer = (player: Player) => {
    setSelected(player);
    setQuery("");
    setResults([]);
    onSelectPlayer(player);
  };

  const clearPlayer = () => {
    setSelected(null);
    setAtBats([]);
    setExpandedKey(null);
    onSelectPlayer(null);
  };

  const abKey = (ab: AtBatSummary) => `${ab.game_pk}-${ab.at_bat_number}`;

  return (
    <aside
      className={
        open
          ? `side-rail side-rail--${role} open`
          : `side-rail side-rail--${role}`
      }
      aria-label={`${title} browser`}
    >
      <div className="side-rail-head">
        <div>
          <p className="side-rail-kicker">{title}</p>
          <h2 className="side-rail-title">
            {selected
              ? `${selected.last_name}, ${selected.first_name}`
              : `Find ${title.toLowerCase()}`}
          </h2>
          {selected && (
            <p className="side-rail-meta">
              {selected.team} · {selected.primary_position} · {selected.throws}/
              {selected.bats}
            </p>
          )}
          {matchupPlayerId != null && selected && (
            <p className="side-rail-matchup">Matchup filter on</p>
          )}
        </div>
        <div className="side-rail-head-actions">
          {selected && (
            <button type="button" className="side-rail-ghost" onClick={clearPlayer}>
              Clear
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="side-rail-ghost side-rail-close-mobile"
              onClick={onClose}
              aria-label="Close panel"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="side-rail-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
        />
        {searching && <span className="side-rail-search-status">…</span>}
      </div>

      {results.length > 0 && (
        <ul className="side-rail-results">
          {results.map((p) => (
            <li key={p.player_id}>
              <button type="button" onClick={() => pickPlayer(p)}>
                <strong>
                  {p.last_name}, {p.first_name}
                </strong>
                <span>
                  {p.team} · {p.primary_position}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="side-rail-body">
        {!selected && (
          <p className="side-rail-empty">
            Search a name. Open an at-bat. Tap a pitch to fly it.
          </p>
        )}
        {selected && abLoading && (
          <p className="side-rail-empty">Loading plate appearances…</p>
        )}
        {selected && abError && <p className="side-rail-error">{abError}</p>}
        {selected && !abLoading && !abError && atBats.length === 0 && (
          <p className="side-rail-empty">
            No at-bats in the warehouse for this player yet. Ingest more days.
          </p>
        )}

        <ul className="side-rail-abs">
          {atBats.map((ab) => {
            const key = abKey(ab);
            const openAb = expandedKey === key;
            return (
              <li key={key} className={openAb ? "ab-card open" : "ab-card"}>
                <button
                  type="button"
                  className="ab-card-main"
                  onClick={() => {
                    setExpandedKey(openAb ? null : key);
                    onSelectPitch(ab.first_pitch_rowid);
                  }}
                >
                  <div className="ab-card-top">
                    <span className="ab-date">{ab.game_date}</span>
                    <span className="ab-count">{ab.pitch_count}p</span>
                  </div>
                  <div className="ab-line">
                    {ab.away_team}@{ab.home_team}
                    {ab.inning != null && (
                      <>
                        {" "}
                        · {ab.inning_topbot === "Top" ? "T" : "B"}
                        {ab.inning}
                      </>
                    )}
                  </div>
                  <div className="ab-types">
                    {ab.pitch_types.map((t, i) => (
                      <span
                        key={`${key}-${i}`}
                        style={{ color: colorForPitchType(t) }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {ab.result && (
                    <div className="ab-result">
                      {ab.result.replace(/_/g, " ")}
                    </div>
                  )}
                </button>
                {openAb && (
                  <div className="ab-chips">
                    {ab.pitches.map((p) => (
                      <button
                        key={p.rowid}
                        type="button"
                        className={
                          activeRowid === p.rowid
                            ? "ab-chip active"
                            : "ab-chip"
                        }
                        style={{
                          ["--pitch-color" as string]: colorForPitchType(
                            p.pitch_type
                          ),
                        }}
                        onClick={() => onSelectPitch(p.rowid)}
                      >
                        <span className="ab-chip-n">P{p.pitch_number}</span>
                        <span className="ab-chip-t">{p.pitch_type ?? "?"}</span>
                        <span className="ab-chip-v">
                          {p.release_speed != null
                            ? p.release_speed.toFixed(0)
                            : "-"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {selected && abTotalPages > 1 && (
          <div className="side-rail-pager">
            <button
              type="button"
              disabled={abPage <= 1 || abLoading}
              onClick={() =>
                selected && loadAtBats(selected.player_id, abPage - 1)
              }
            >
              Prev
            </button>
            <span>
              {abPage}/{abTotalPages}
            </span>
            <button
              type="button"
              disabled={abPage >= abTotalPages || abLoading}
              onClick={() =>
                selected && loadAtBats(selected.player_id, abPage + 1)
              }
            >
              Next
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
