/**
 * Module-level camera memory for the pitch stage.
 * Survives React remounts so viewpoint is not reset on pitch / sequence changes.
 */

export type CameraSnapshot = {
  position: [number, number, number];
  target: [number, number, number];
};

let snapshot: CameraSnapshot | null = null;
/** After the first auto-frame or restore, never auto-frame to a new path again. */
let framedOnce = false;

export function getCameraSnapshot(): CameraSnapshot | null {
  return snapshot;
}

export function setCameraSnapshot(next: CameraSnapshot): void {
  snapshot = {
    position: [next.position[0], next.position[1], next.position[2]],
    target: [next.target[0], next.target[1], next.target[2]],
  };
}

export function hasFramedCamera(): boolean {
  return framedOnce || snapshot != null;
}

export function markCameraFramed(): void {
  framedOnce = true;
}

export function clearCameraSnapshot(): void {
  snapshot = null;
  framedOnce = false;
}
