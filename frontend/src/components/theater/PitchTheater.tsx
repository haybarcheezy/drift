import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import ApiService from "../../services/api";
import type { Pitch, PitchFlightResponse } from "../../types";
import { colorForPitchType } from "./pitchColors";
import PitchScene from "./PitchScene";
import "./theater.css";

export interface PitchTheaterProps {
  rowid: number;
  /** Overlay closes; page mode is the permanent stage (no close). */
  variant?: "page" | "overlay";
  onClose?: () => void;
  onPitchMeta?: (pitch: Pitch | null) => void;
}

export default function PitchTheater({
  rowid,
  variant = "overlay",
  onClose,
  onPitchMeta,
}: PitchTheaterProps) {
  const [items, setItems] = useState<PitchFlightResponse[]>([]);
  const [activeRowid, setActiveRowid] = useState<number>(rowid);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [tunnelMode, setTunnelMode] = useState(false);
  const rafRef = useRef<number>();
  const lastTs = useRef<number>(0);
  const isPage = variant === "page";

  useEffect(() => {
    let cancelled = false;
    // Soft load: keep previous path + camera mounted while fetching.
    // Only show the full-screen loader on the first pitch (empty stage).
    const isFirstLoad = items.length === 0;
    if (isFirstLoad) setLoading(true);
    setError("");
    setProgress(0);
    setPlaying(true);
    setTunnelMode(false);

    (async () => {
      try {
        const primary = await ApiService.getPitchFlight(rowid);
        if (cancelled) return;

        let sequence: PitchFlightResponse[] = [primary];
        const { game_pk, at_bat_number } = primary.pitch;
        if (game_pk != null && at_bat_number != null) {
          try {
            const ab = await ApiService.getAtBat(game_pk, at_bat_number);
            if (!cancelled && ab.pitches?.length) {
              sequence = ab.pitches.filter(
                (p) => p.flight != null
              ) as PitchFlightResponse[];
              if (!sequence.some((p) => p.pitch.rowid === primary.pitch.rowid)) {
                sequence = [primary, ...sequence];
              }
            }
          } catch {
            // At-bat optional
          }
        }

        setItems(sequence);
        setActiveRowid(primary.pitch.rowid);
        onPitchMeta?.(primary.pitch);
      } catch {
        if (!cancelled) {
          setError("Could not reconstruct this pitch flight.");
          onPitchMeta?.(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // items.length intentionally omitted: only used to decide first-load UI
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowid, onPitchMeta]);

  useEffect(() => {
    if (!playing || tunnelMode || loading) return;
    lastTs.current = performance.now();
    const tick = (ts: number) => {
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      setProgress((p) => {
        const next = p + dt / 1.55;
        if (next >= 1) {
          // Loop on page mode for ambient showcase
          if (isPage) return 0;
          setPlaying(false);
          return 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tunnelMode, loading, activeRowid, isPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPage) onClose?.();
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (!tunnelMode) setPlaying((v) => !v);
      }
      if (e.key === "t" || e.key === "T") setTunnelMode((v) => !v);
      if (e.key === "ArrowLeft") {
        setPlaying(false);
        setProgress((p) => Math.max(0, p - 0.04));
      }
      if (e.key === "ArrowRight") {
        setPlaying(false);
        setProgress((p) => Math.min(1, p + 0.04));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, tunnelMode, isPage]);

  const active = useMemo(
    () => items.find((i) => i.pitch.rowid === activeRowid) ?? items[0],
    [items, activeRowid]
  );

  const paths = useMemo(
    () =>
      items
        .filter((i) => i.flight)
        .map((i) => ({
          pitch: i.pitch,
          flight: i.flight,
          active: i.pitch.rowid === (active?.pitch.rowid ?? activeRowid),
        })),
    [items, active, activeRowid]
  );

  const selectPitch = useCallback((id: number) => {
    setActiveRowid(id);
    setProgress(0);
    setPlaying(true);
    setTunnelMode(false);
    const hit = items.find((i) => i.pitch.rowid === id);
    if (hit) onPitchMeta?.(hit.pitch);
  }, [items, onPitchMeta]);

  const pitch: Pitch | undefined = active?.pitch;
  const color = colorForPitchType(pitch?.pitch_type);

  const shellClass = isPage
    ? "theater-shell theater-shell--page"
    : "theater-shell theater-shell--overlay theater-overlay";

  return (
    <div
      className={shellClass}
      role={isPage ? "region" : "dialog"}
      aria-label="Pitch theater"
    >
      <div className="theater-canvas-wrap">
        {/* Keep Canvas mounted once we have any path so orbit/zoom survive pitch changes. */}
        {paths.length > 0 && (
          <Canvas
            className="theater-canvas"
            // Stable identity: never remount the GL context for pitch swaps.
            shadows
            dpr={[1, 1.75]}
            camera={{
              position: [18, 8, -12],
              fov: 40,
              near: 0.1,
              far: 300,
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance",
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              display: "block",
            }}
          >
            <PitchScene
              paths={paths}
              progress={tunnelMode ? 1 : progress}
              tunnelMode={tunnelMode}
            />
          </Canvas>
        )}

        {loading && paths.length === 0 && (
          <div className="theater-loading">
            <div className="theater-loading-orb" />
            <span>Reconstructing flight path</span>
          </div>
        )}
        {loading && paths.length > 0 && (
          <div className="theater-loading-soft" aria-hidden>
            <div className="theater-loading-orb theater-loading-orb--sm" />
          </div>
        )}
        {error && paths.length === 0 && (
          <div className="theater-error">
            <div>{error}</div>
            {!isPage && (
              <button type="button" className="theater-btn" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        )}

        {pitch && (
          <div className="theater-hud">
            <div className="theater-top-left theater-glass">
              <p className="theater-kicker">Statcast kinematic path</p>
              <h2 className="theater-title">
                {pitch.player_name ?? `Pitcher #${pitch.pitcher}`}
              </h2>
              <p className="theater-subtitle">
                {pitch.away_team} @ {pitch.home_team}
                {pitch.game_date ? `  ·  ${pitch.game_date}` : ""}
                {pitch.inning != null && (
                  <>
                    {"  ·  "}
                    {pitch.inning_topbot === "Top" ? "T" : "B"}
                    {pitch.inning}
                  </>
                )}
              </p>
              <div className="theater-chip-row">
                <span
                  className="theater-chip accent"
                  style={{ ["--pitch-color" as string]: color }}
                >
                  <strong>{pitch.pitch_type ?? "-"}</strong>
                  {pitch.pitch_name ?? ""}
                </span>
                <span className="theater-chip">
                  <strong>
                    {pitch.release_speed != null
                      ? pitch.release_speed.toFixed(1)
                      : "-"}
                  </strong>
                  mph
                </span>
                <span className="theater-chip">
                  <strong>
                    {pitch.release_spin_rate != null
                      ? Math.round(pitch.release_spin_rate)
                      : "-"}
                  </strong>
                  rpm
                </span>
                <span className="theater-chip">
                  <strong>
                    {pitch.balls ?? 0}-{pitch.strikes ?? 0}
                  </strong>
                  count
                </span>
                {pitch.pfx_x != null && pitch.pfx_z != null && (
                  <span className="theater-chip">
                    <strong>
                      {pitch.pfx_x.toFixed(1)}/{pitch.pfx_z.toFixed(1)}
                    </strong>
                    break
                  </span>
                )}
              </div>
              <div
                className={
                  active?.flight.mode === "linear_fallback"
                    ? "theater-mode-badge warn"
                    : "theater-mode-badge"
                }
              >
                {active?.flight.mode === "kinematic"
                  ? "9-param model · plate-blended endpoint"
                  : "Estimated path · missing kinematics"}
              </div>
              {pitch.description && (
                <p className="theater-subtitle" style={{ marginTop: "0.5rem" }}>
                  {pitch.description.replace(/_/g, " ")}
                  {pitch.events ? ` → ${pitch.events.replace(/_/g, " ")}` : ""}
                </p>
              )}
            </div>

            <div className="theater-top-right">
              <button
                type="button"
                className={tunnelMode ? "theater-btn active" : "theater-btn"}
                onClick={() => {
                  setTunnelMode((v) => !v);
                  setPlaying(false);
                }}
                title="Freeze tunnel at 150ms (T)"
              >
                Tunnel
              </button>
              {!isPage && (
                <button
                  type="button"
                  className="theater-btn close"
                  onClick={onClose}
                  aria-label="Close theater"
                >
                  ×
                </button>
              )}
            </div>

            <div className="theater-bottom">
              {items.length > 1 && (
                <div className="theater-sequence">
                  {items.map((item, idx) => {
                    const c = colorForPitchType(item.pitch.pitch_type);
                    const isActive = item.pitch.rowid === activeRowid;
                    return (
                      <button
                        key={item.pitch.rowid}
                        type="button"
                        className={
                          isActive ? "theater-seq-btn active" : "theater-seq-btn"
                        }
                        style={{ ["--pitch-color" as string]: c }}
                        onClick={() => selectPitch(item.pitch.rowid)}
                      >
                        P{idx + 1} {item.pitch.pitch_type ?? "?"}
                        {item.pitch.release_speed != null &&
                          ` · ${item.pitch.release_speed.toFixed(0)}`}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="theater-controls theater-glass">
                <button
                  type="button"
                  className="theater-btn"
                  disabled={tunnelMode}
                  onClick={() => {
                    if (progress >= 1) setProgress(0);
                    setPlaying((v) => !v);
                  }}
                >
                  {playing ? "Pause" : progress >= 1 ? "Replay" : "Play"}
                </button>
                <input
                  className="theater-scrub"
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={tunnelMode ? 1 : progress}
                  disabled={tunnelMode}
                  onChange={(e) => {
                    setPlaying(false);
                    setProgress(Number(e.target.value));
                  }}
                />
                <span className="theater-hint">
                  Space · ←/→ · T tunnel
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
