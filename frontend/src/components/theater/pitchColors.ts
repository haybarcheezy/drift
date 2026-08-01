/** Broadcast-style pitch-type palette for 3D paths and HUD chips. */
export const PITCH_COLORS: Record<string, string> = {
  FF: "#ff3b3b",
  SI: "#ff8c1a",
  FC: "#f5a623",
  SL: "#2ee59d",
  ST: "#7CFF6B",
  CU: "#b44aff",
  KC: "#9b59ff",
  CH: "#3aa0ff",
  FS: "#1ec8c8",
  SV: "#ff6bcb",
  KN: "#a0aec0",
  EP: "#cbd5e0",
  CS: "#d4a5ff",
  SC: "#63b3ed",
};

export function colorForPitchType(code: string | null | undefined): string {
  if (!code) return "#e2e8f0";
  return PITCH_COLORS[code.toUpperCase()] ?? "#e2e8f0";
}
