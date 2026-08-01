/**
 * Module-level camera memory for the pitch stage.
 * Survives React remounts of PitchTheater / Canvas / PitchScene so the
 * user viewpoint is not reset when selecting another pitch.
 */

export type CameraSnapshot = {
  position: [number, number, number];
  target: [number, number, number];
};

let snapshot: CameraSnapshot | null = null;

export function getCameraSnapshot(): CameraSnapshot | null {
  return snapshot;
}

export function setCameraSnapshot(next: CameraSnapshot): void {
  snapshot = {
    position: [...next.position],
    target: [...next.target],
  };
}

export function clearCameraSnapshot(): void {
  snapshot = null;
}
