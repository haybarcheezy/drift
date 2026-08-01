import * as THREE from "three";
import type { FlightSample } from "../../types";

/**
 * Statcast (catcher view) → Three.js scene.
 *   x → X (1B positive)
 *   z → Y (up)
 *   y → -Z (depth; plate near 0, mound in +Z after negation of large y)
 */
export function toScene(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, z, -y);
}

export function sampleToScene(s: FlightSample): THREE.Vector3 {
  return toScene(s.x, s.y, s.z);
}

export function samplesToPositions(
  samples: FlightSample[]
): [number, number, number][] {
  return samples.map((s) => {
    const v = sampleToScene(s);
    return [v.x, v.y, v.z];
  });
}
