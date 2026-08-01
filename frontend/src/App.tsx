import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import ApiService from "./services/api";
import FilterBar from "./components/FilterBar";
import PitchRail from "./components/PitchRail";
import PitchTheater from "./components/theater/PitchTheater";
import type {
  Pagination as PaginationMeta,
  Pitch,
  PitchFilterOptions,
  PitchType,
} from "./types";

const DEFAULT_FILTERS: PitchFilterOptions = {
  // Broad default so the stage boots even if the day is soft-velo heavy
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

  useEffect(() => {
    ApiService.getPitchTypes().then(setPitchTypes).catch(() => undefined);
    ApiService.getTeams().then(setTeams).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    ApiService.getPitches(filters)
      .then((res) => {
        if (cancelled) return;
        setPitches(res.data);
        setPagination(res.pagination);
        // First successful load: auto-open the best pitch so the theater is live immediately
        if (!bootstrapped && res.data.length > 0) {
          setActiveRowid(res.data[0].rowid);
          setBootstrapped(true);
        } else if (
          bootstrapped &&
          res.data.length > 0 &&
          activeRowid != null &&
          !res.data.some((p) => p.rowid === activeRowid)
        ) {
          setActiveRowid(res.data[0].rowid);
        } else if (res.data.length === 0) {
          setActiveRowid(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch on filter changes
  }, [filters]);

  const onSelectPitch = useCallback((pitch: Pitch) => {
    setActiveRowid(pitch.rowid);
  }, []);

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
        <div className="pf-top-stats">
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
        <section className="pf-stage-shell" aria-label="3D pitch stage">
          {activeRowid != null ? (
            <PitchTheater variant="page" rowid={activeRowid} />
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
                <p>No pitch available for the stage. Widen filters below.</p>
              )}
            </div>
          )}
        </section>

        <section className="pf-rail-panel">
          <div className="pf-rail-head">
            <h2>Heat strip</h2>
            <p>Tap a card. Theater updates instantly.</p>
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
