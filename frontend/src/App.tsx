import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import ApiService from "./services/api";
import FilterBar from "./components/FilterBar";
import PitchRail from "./components/PitchRail";
import SideRail from "./components/SideRail";
import PitchTheater from "./components/theater/PitchTheater";
import type {
  Pagination as PaginationMeta,
  Pitch,
  PitchFilterOptions,
  PitchType,
  Player,
} from "./types";

const DEFAULT_FILTERS: PitchFilterOptions = {
  min_velocity: 88,
  per_page: 36,
  page: 1,
};

const App: React.FC = () => {
  const [pitchTypes, setPitchTypes] = useState<PitchType[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [filters, setFilters] = useState<PitchFilterOptions>(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRowid, setActiveRowid] = useState<number | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [pitcher, setPitcher] = useState<Player | null>(null);
  const [batter, setBatter] = useState<Player | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEffect(() => {
    ApiService.getPitchTypes().then(setPitchTypes).catch(() => undefined);
    ApiService.getTeams().then(setTeams).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const slice: PitchFilterOptions = {
      ...filters,
      pitcher: pitcher?.player_id,
      batter: batter?.player_id,
    };

    ApiService.getPitches(slice)
      .then((res) => {
        if (cancelled) return;
        setPitches(res.data);
        setPagination(res.pagination);
        if (!bootstrapped && res.data.length > 0) {
          setActiveRowid(res.data[0].rowid);
          setBootstrapped(true);
        } else if (
          res.data.length > 0 &&
          (pitcher || batter) &&
          (activeRowid == null ||
            !res.data.some((p) => p.rowid === activeRowid))
        ) {
          setActiveRowid(res.data[0].rowid);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load pitch slice from API.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pitcher?.player_id, batter?.player_id]);

  const onSelectPitch = useCallback((pitch: Pitch) => {
    setActiveRowid(pitch.rowid);
  }, []);

  const onSelectPitchRowid = useCallback((rowid: number) => {
    setActiveRowid(rowid);
    setLeftOpen(false);
    setRightOpen(false);
  }, []);

  const matchupLabel =
    pitcher && batter
      ? `${pitcher.last_name} vs ${batter.last_name}`
      : pitcher
        ? pitcher.last_name
        : batter
          ? `vs ${batter.last_name}`
          : null;

  return (
    <div className="pf">
      <div className="pf-grain" aria-hidden />
      <div className="pf-glow pf-glow-a" aria-hidden />
      <div className="pf-glow pf-glow-b" aria-hidden />

      <header className="pf-top">
        <div className="pf-brand">
          <span className="pf-mark" aria-hidden />
          <div>
            <h1 className="pf-logo">DRIFT</h1>
            <p className="pf-tagline">
              See the pitch. Catch the change. Live Statcast paths and tunnels.
            </p>
          </div>
        </div>
        <div className="pf-top-actions">
          <button
            type="button"
            className="pf-drawer-btn"
            onClick={() => {
              setLeftOpen(true);
              setRightOpen(false);
            }}
          >
            Pitcher
          </button>
          <button
            type="button"
            className="pf-drawer-btn"
            onClick={() => {
              setRightOpen(true);
              setLeftOpen(false);
            }}
          >
            Batter
          </button>
        </div>
        <div className="pf-top-stats">
          {matchupLabel && (
            <div className="pf-stat pf-stat--accent">
              <span className="pf-stat-label">Focus</span>
              <span className="pf-stat-value pf-stat-value--sm">
                {matchupLabel}
              </span>
            </div>
          )}
          <div className="pf-stat">
            <span className="pf-stat-label">Slice</span>
            <span className="pf-stat-value">
              {pagination ? pagination.total.toLocaleString() : "-"}
            </span>
          </div>
          <div className="pf-stat">
            <span className="pf-stat-label">Source</span>
            <span className="pf-stat-value pf-stat-value--sm">Savant</span>
          </div>
        </div>
      </header>

      <main className="pf-main">
        <div className="pf-workbench">
          {leftOpen && (
            <button
              type="button"
              className="pf-drawer-scrim"
              aria-label="Close pitcher panel"
              onClick={() => setLeftOpen(false)}
            />
          )}
          <SideRail
            role="pitcher"
            matchupPlayerId={batter?.player_id}
            selectedPlayerId={pitcher?.player_id ?? null}
            activeRowid={activeRowid}
            onSelectPlayer={setPitcher}
            onSelectPitch={onSelectPitchRowid}
            open={leftOpen}
            onClose={() => setLeftOpen(false)}
          />

          <div className="pf-center">
            <section className="pf-stage-shell" aria-label="3D pitch stage">
              {/* Keep one PitchTheater instance mounted so the WebGL context
                  and camera snapshot survive pitch switches. */}
              {activeRowid != null ? (
                <PitchTheater
                  key="stage"
                  variant="page"
                  rowid={activeRowid}
                />
              ) : (
                <div className="pf-stage-empty">
                  {loading ? (
                    <>
                      <div className="theater-loading-orb" />
                      <p>Loading live pitch theater…</p>
                    </>
                  ) : error ? (
                    <p className="pf-error">{error}</p>
                  ) : (
                    <p>
                      Search a pitcher or batter, or pick from the heat strip.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="pf-rail-panel">
              <div className="pf-rail-head">
                <h2>Heat strip</h2>
                <p>Recent slice. Side rails for at-bat deep dive.</p>
              </div>
              <FilterBar
                filters={filters}
                pitchTypes={pitchTypes}
                teams={teams}
                total={pagination?.total}
                onChange={setFilters}
              />
              {error && <p className="pf-error pf-error-inline">{error}</p>}
              <PitchRail
                pitches={pitches}
                activeRowid={activeRowid}
                loading={loading}
                onSelect={onSelectPitch}
              />
              {pagination && pagination.total_pages > 1 && (
                <div className="pf-pager">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                    }
                  >
                    Prev
                  </button>
                  <span>
                    {pagination.page} / {pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.total_pages}
                    onClick={() =>
                      setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                    }
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </div>

          {rightOpen && (
            <button
              type="button"
              className="pf-drawer-scrim pf-drawer-scrim--right"
              aria-label="Close batter panel"
              onClick={() => setRightOpen(false)}
            />
          )}
          <SideRail
            role="batter"
            matchupPlayerId={pitcher?.player_id}
            selectedPlayerId={batter?.player_id ?? null}
            activeRowid={activeRowid}
            onSelectPlayer={setBatter}
            onSelectPitch={onSelectPitchRowid}
            open={rightOpen}
            onClose={() => setRightOpen(false)}
          />
        </div>
      </main>

      <footer className="pf-foot">
        <span>DRIFT</span>
        <span className="pf-foot-sep" />
        <span>MLB Stats API rosters · Baseball Savant paths</span>
      </footer>
    </div>
  );
};

export default App;
