import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { FlightPath, Pitch } from "../../types";
import { colorForPitchType } from "./pitchColors";
import { sampleToScene, samplesToPositions, toScene } from "./coords";

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
  // Simple plate diamond in scene XZ (y = ground). Plate face toward mound (+X? no: mound is -Z).
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
      {/* Zone grid 3x3 */}
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
  minDistance: number;
  maxDistance: number;
  update: () => void;
};

/** Frame the active path so the full flight sits centered in view (not off to one side). */
function CameraFramer({
  path,
  controlsRef,
}: {
  path: FlightPath | null;
  controlsRef: React.MutableRefObject<ControlsLike | null>;
}) {
  const { camera } = useThree();
  const framedKey = useRef<string>("");

  useEffect(() => {
    if (!path?.samples?.length) return;
    const key = `${path.samples.length}-${path.t_plate}-${path.samples[0].x}`;
    if (framedKey.current === key) return;
    framedKey.current = key;

    const box = new THREE.Box3();
    for (const s of path.samples) {
      box.expandByPoint(sampleToScene(s));
    }
    // Keep plate / zone in frame
    box.expandByPoint(new THREE.Vector3(0, 2.5, -1.4));
    box.expandByPoint(new THREE.Vector3(0, 0, -1.4));

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    // Bias center slightly toward plate so release doesn't yank framing
    center.z = center.z * 0.65 + -1.4 * 0.35;
    center.y = Math.max(center.y, 2.2);

    const span = Math.max(size.x, size.y, size.z, 20);
    // 3/4 view from first-base side, elevated
    const dist = span * 0.95;
    const camPos = new THREE.Vector3(
      center.x + dist * 0.55,
      center.y + dist * 0.28,
      center.z + dist * 0.42
    );

    camera.position.copy(camPos);
    camera.near = 0.1;
    camera.far = 300;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(center);
      controls.minDistance = Math.max(6, span * 0.25);
      controls.maxDistance = Math.max(40, span * 2.2);
      controls.update();
    }
  }, [path, camera, controlsRef]);

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

      {/* Rubber hint */}
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

      <CameraFramer
        path={active?.flight ?? null}
        controlsRef={controlsRef}
      />

      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        target={[0, 2.8, -22]}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={8}
        maxDistance={90}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}
