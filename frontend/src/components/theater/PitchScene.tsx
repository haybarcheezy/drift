import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { FlightPath, Pitch } from "../../types";
import { colorForPitchType } from "./pitchColors";
import { sampleToScene, samplesToPositions, toScene } from "./coords";
import { getCameraSnapshot, setCameraSnapshot } from "./cameraStore";

interface PathLayer {
  pitch: Pitch;
  flight: FlightPath;
  active: boolean;
}

interface PitchSceneProps {
  paths: PathLayer[];
  progress: number;
  tunnelMode: boolean;
}

function HomePlate() {
  return (
    <group position={[0, 0.02, -1.417]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.85, 4]} />
        <meshStandardMaterial color="#e8edf5" roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.005, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -28]} receiveShadow>
      <planeGeometry args={[50, 80]} />
      <meshStandardMaterial color="#0a101c" roughness={0.95} />
    </mesh>
  );
}

function StrikeZone({
  szTop,
  szBot,
}: {
  szTop: number | null | undefined;
  szBot: number | null | undefined;
}) {
  const top = szTop ?? 3.5;
  const bot = szBot ?? 1.5;
  const height = Math.max(0.2, top - bot);
  const midY = (top + bot) / 2;
  const width = 17 / 12;

  return (
    <group position={[0, midY, -1.417]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color="#e8a14a"
          transparent
          opacity={0.14}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
        <lineBasicMaterial color="#e8a14a" transparent opacity={0.85} />
      </lineSegments>
      {[1, 2].map((i) => (
        <group key={i}>
          <mesh position={[-width / 2 + (width * i) / 3, 0, 0.001]}>
            <planeGeometry args={[0.01, height]} />
            <meshBasicMaterial color="#e8a14a" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0, -height / 2 + (height * i) / 3, 0.001]}>
            <planeGeometry args={[width, 0.01]} />
            <meshBasicMaterial color="#e8a14a" transparent opacity={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FlightRibbon({
  path,
  color,
  active,
  progress,
  tunnelMode,
}: {
  path: FlightPath;
  color: string;
  active: boolean;
  progress: number;
  tunnelMode: boolean;
}) {
  const ballRef = useRef<THREE.Mesh>(null);
  const positions = useMemo(
    () => samplesToPositions(path.samples),
    [path.samples]
  );
  const tunnelPos = useMemo(() => sampleToScene(path.tunnel), [path.tunnel]);

  useFrame(() => {
    if (!ballRef.current || !active || tunnelMode) return;
    const samples = path.samples;
    if (samples.length < 2) return;
    const idx = progress * (samples.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = idx - i0;
    const a = sampleToScene(samples[i0]);
    const b = sampleToScene(samples[i1]);
    ballRef.current.position.lerpVectors(a, b, frac);
  });

  const opacity = active ? 1 : tunnelMode ? 0.55 : 0.22;
  const lineWidth = active ? 3 : 1.6;

  if (positions.length < 2) return null;

  return (
    <group>
      <Line
        points={positions}
        color={color}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
      />
      <Line
        points={positions}
        color={color}
        lineWidth={lineWidth * 3.5}
        transparent
        opacity={opacity * 0.14}
      />

      {tunnelMode && (
        <mesh position={tunnelPos}>
          <sphereGeometry args={[0.14, 20, 20]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.5}
            transparent
            opacity={0.95}
          />
        </mesh>
      )}

      {active && !tunnelMode && (
        <mesh ref={ballRef} castShadow>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive={color}
            emissiveIntensity={0.65}
            roughness={0.22}
            metalness={0.12}
          />
        </mesh>
      )}

      <mesh
        position={toScene(
          path.samples[0].x,
          path.samples[0].y,
          path.samples[0].z
        )}
      >
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

type ControlsLike = {
  target: THREE.Vector3;
  object: THREE.Camera;
  minDistance: number;
  maxDistance: number;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

function framePath(
  path: FlightPath,
  camera: THREE.Camera,
  controls: ControlsLike | null
): void {
  const box = new THREE.Box3();
  for (const s of path.samples) {
    box.expandByPoint(sampleToScene(s));
  }
  box.expandByPoint(new THREE.Vector3(0, 2.5, -1.4));
  box.expandByPoint(new THREE.Vector3(0, 0, -1.4));

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  center.z = center.z * 0.65 + -1.4 * 0.35;
  center.y = Math.max(center.y, 2.2);

  const span = Math.max(size.x, size.y, size.z, 20);
  const dist = span * 0.95;
  const camPos = new THREE.Vector3(
    center.x + dist * 0.55,
    center.y + dist * 0.28,
    center.z + dist * 0.42
  );

  camera.position.copy(camPos);
  if ("near" in camera) {
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = 300;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }
  camera.lookAt(center);

  if (controls) {
    controls.target.copy(center);
    controls.minDistance = Math.max(6, span * 0.25);
    controls.maxDistance = Math.max(40, span * 2.2);
    controls.update();
  }

  setCameraSnapshot({
    position: [camPos.x, camPos.y, camPos.z],
    target: [center.x, center.y, center.z],
  });
}

function applySnapshot(
  camera: THREE.Camera,
  controls: ControlsLike | null
): boolean {
  const snap = getCameraSnapshot();
  if (!snap) return false;
  camera.position.set(...snap.position);
  if (controls) {
    controls.target.set(...snap.target);
    controls.update();
  } else {
    camera.lookAt(
      new THREE.Vector3(snap.target[0], snap.target[1], snap.target[2])
    );
  }
  return true;
}

function persistCamera(camera: THREE.Camera, controls: ControlsLike | null) {
  const prev = getCameraSnapshot();
  const t = controls?.target;
  setCameraSnapshot({
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: t
      ? [t.x, t.y, t.z]
      : (prev?.target ?? [0, 2.8, -22]),
  });
}

/**
 * Restore last user viewpoint (module store), or auto-frame once.
 * Never re-frame on pitch change after a snapshot exists.
 */
function CameraRig({
  path,
  controlsRef,
}: {
  path: FlightPath | null;
  controlsRef: React.MutableRefObject<ControlsLike | null>;
}) {
  const { camera } = useThree();

  // Restore snapshot (or initial frame) after controls attach. Re-run when
  // path changes only to re-apply the *same* snapshot if the tree remounted.
  useEffect(() => {
    let alive = true;
    const apply = () => {
      if (!alive) return;
      const controls = controlsRef.current;
      if (getCameraSnapshot()) {
        applySnapshot(camera, controls);
        return;
      }
      if (path?.samples?.length) {
        framePath(path, camera, controls);
      }
    };
    // Two frames: OrbitControls ref is often null on the first.
    const id1 = requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id1);
      persistCamera(camera, controlsRef.current);
    };
  }, [camera, controlsRef, path]);

  // Persist every frame while user is interacting (damping makes "end" late).
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Only write while controls report a recent change via damping motion;
    // always cheap: three floats.
    persistCamera(camera, controls);
  });

  return null;
}

export default function PitchScene({
  paths,
  progress,
  tunnelMode,
}: PitchSceneProps) {
  const active = paths.find((p) => p.active) ?? paths[0];
  const controlsRef = useRef<ControlsLike | null>(null);

  return (
    <>
      <color attach="background" args={["#06080f"]} />
      <fog attach="fog" args={["#06080f", 40, 110]} />

      <ambientLight intensity={0.32} />
      <directionalLight position={[12, 22, 8]} intensity={1.15} castShadow />
      <spotLight
        position={[-8, 16, -6]}
        angle={0.5}
        penumbra={0.7}
        intensity={0.75}
        color="#9ec5ff"
      />
      <pointLight position={[0, 5, -2]} intensity={0.5} color="#e8a14a" />
      <pointLight position={[2, 3, -30]} intensity={0.35} color="#4f7cff" />

      <Ground />
      <HomePlate />
      {active && (
        <StrikeZone
          szTop={active.pitch.sz_top}
          szBot={active.pitch.sz_bot}
        />
      )}

      <mesh position={[0, 0.02, -55]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 1.05, 48]} />
        <meshBasicMaterial color="#3d4a63" transparent opacity={0.55} />
      </mesh>

      <mesh position={[0, 0.03, -55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.15]} />
        <meshBasicMaterial color="#cbd5e1" transparent opacity={0.35} />
      </mesh>

      {paths.map(({ pitch, flight, active: isActive }) => (
        <FlightRibbon
          key={pitch.rowid}
          path={flight}
          color={colorForPitchType(pitch.pitch_type)}
          active={isActive}
          progress={progress}
          tunnelMode={tunnelMode}
        />
      ))}

      <CameraRig path={active?.flight ?? null} controlsRef={controlsRef} />

      {/*
        Do NOT pass a `target` prop — drei re-applies it on re-render and
        steals the user's viewpoint whenever paths update.
      */}
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        maxPolarAngle={Math.PI * 0.49}
        minDistance={8}
        maxDistance={90}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}
