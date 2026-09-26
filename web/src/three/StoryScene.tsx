// "How it works" - one 3-D stage that morphs through the six protocol steps as the reader scrolls:
// 0 keys · 1 teleport · 2 sign · 3 verify · 4 detect (an eavesdropper appears and is caught) · 5 record.
import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Label, SceneCanvas, usePalette } from "./common";

const SIGNER = new THREE.Vector3(-2.2, 0, 0);
const VERIFIER = new THREE.Vector3(2.2, 0, 0);
const QUBITS = 18;
const damp = (a: number, b: number, dt: number, k = 4) => a + (b - a) * (1 - Math.exp(-dt * k));

function Qubits({ stage, eve }: { stage: number; eve: boolean }) {
  const p = usePalette();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const basisColor = useMemo(() => [new THREE.Color(p.brand), new THREE.Color(p.violet), new THREE.Color(p.ok)], [p.brand, p.violet, p.ok]);
  const seeds = useMemo(() => Array.from({ length: QUBITS }, (_, i) => ({ basis: i % 3, phase: (i / QUBITS) * Math.PI * 2, chosen: i % 3 !== 1 })), []);
  const t = useRef(0);
  useLayoutEffect(() => {
    // Create the per-instance colour buffer before the material first compiles.
    const m = mesh.current;
    if (!m) return;
    seeds.forEach((q, i) => m.setColorAt(i, basisColor[q.basis]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [seeds, basisColor]);
  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    t.current = damp(t.current, stage, dt, 2.2);
    const s = t.current;
    const clock = state.clock.elapsedTime;
    seeds.forEach((q, i) => {
      // orbit around the signer (keys) -> fly along the beam (teleport) -> ring at the verifier.
      const orbit = new THREE.Vector3(Math.cos(q.phase + clock * 0.6) * 0.95, Math.sin(q.phase * 2 + clock * 0.8) * 0.45, Math.sin(q.phase + clock * 0.6) * 0.95).add(SIGNER);
      const ring = new THREE.Vector3(Math.cos(q.phase + clock * 0.25) * 1.05, Math.sin(q.phase + clock * 0.25) * 1.05, 0).add(VERIFIER);
      const k = THREE.MathUtils.clamp(s - 0.6, 0, 1);
      const fly = (clock * 0.35 + i / QUBITS) % 1;
      const beam = SIGNER.clone().lerp(VERIFIER, fly).add(new THREE.Vector3(0, Math.sin(fly * Math.PI) * 0.8, 0));
      let pos = orbit;
      if (s >= 0.6 && s < 1.6) pos = orbit.clone().lerp(beam, Math.min(1, k * 1.5));
      else if (s >= 1.6) pos = beam.clone().lerp(ring, THREE.MathUtils.clamp(s - 1.6, 0, 1));
      tmp.position.copy(pos);
      const highlight = s > 1.8 && q.chosen ? 1.35 : s > 1.8 ? 0.6 : 1;
      tmp.scale.setScalar(highlight);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      const c = basisColor[q.basis].clone();
      if (eve && s > 3.6 && s < 4.8 && i % 4 === 0) c.set(p.bad);
      m.setColorAt(i, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, QUBITS]}>
      <sphereGeometry args={[0.09, 20, 20]} />
      <meshStandardMaterial emissiveIntensity={0.5} roughness={0.3} />
    </instancedMesh>
  );
}

function Node({ at, color, label }: { at: THREE.Vector3; color: string; label: string }) {
  return (
    <group position={at}>
      <Float speed={1.5} floatIntensity={0.4} rotationIntensity={0.3}>
        <mesh>
          <icosahedronGeometry args={[0.36, 1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} flatShading roughness={0.3} />
        </mesh>
        <mesh scale={1.5}>
          <icosahedronGeometry args={[0.36, 1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
        </mesh>
      </Float>
      <Label position={[0, -0.8, 0]}>{label}</Label>
    </group>
  );
}

function Beam({ stage }: { stage: number }) {
  const p = usePalette();
  const ref = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(SIGNER, new THREE.Vector3(0, 0.8, 0), VERIFIER), []);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.02, 8, false), [curve]);
  const o = useRef(0);
  useFrame((_, dt) => {
    o.current = damp(o.current, stage >= 1 ? 0.9 : 0, dt);
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = o.current;
  });
  return (
    <mesh ref={ref} geometry={geo}>
      <meshBasicMaterial color={p.brand2} transparent opacity={0} />
    </mesh>
  );
}

function DetectorRings({ stage, eve }: { stage: number; eve: boolean }) {
  const p = usePalette();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const lit = useRef(0);
  useFrame(({ clock }, dt) => {
    lit.current = damp(lit.current, stage >= 4 ? 6 : 0, dt, 1.6);
    refs.current.forEach((m, i) => {
      if (!m) return;
      const on = lit.current > i + 0.3;
      m.rotation.x = clock.elapsedTime * (0.3 + i * 0.07) + i;
      m.rotation.y = clock.elapsedTime * (0.2 + i * 0.05);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = damp(mat.opacity, on ? 0.9 : stage >= 3 ? 0.12 : 0, dt, 5);
      mat.color.set(on && eve && stage >= 4 && stage < 5 && (i === 2 || i === 3) ? p.bad : on ? p.ok : p.ink3);
    });
  });
  return (
    <group position={VERIFIER}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
          <torusGeometry args={[0.62 + i * 0.13, 0.012, 8, 96]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

function Eve({ stage }: { stage: number }) {
  const p = usePalette();
  const ref = useRef<THREE.Group>(null);
  const s = useRef(0);
  useFrame(({ clock }, dt) => {
    s.current = damp(s.current, stage >= 3.5 && stage < 5 ? 1 : 0, dt, 3);
    const g = ref.current;
    if (!g) return;
    g.scale.setScalar(Math.max(0.001, s.current));
    g.rotation.y = clock.elapsedTime * 1.5;
  });
  return (
    <group ref={ref} position={[0.3, -1.3, 0.4]}>
      <mesh>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={p.bad} emissive={p.bad} emissiveIntensity={0.8} flatShading />
      </mesh>
      {stage >= 3.5 && stage < 5 && <Label position={[0, -0.55, 0]} tone={p.bad}>Eve · caught by D3 + D4</Label>}
    </group>
  );
}

function LedgerStack({ stage, eve }: { stage: number; eve: boolean }) {
  const p = usePalette();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const k = useRef(0);
  useFrame((_, dt) => {
    k.current = damp(k.current, stage >= 5 ? 1 : 0, dt, 2.5);
    refs.current.forEach((m, i) => {
      if (!m) return;
      const show = THREE.MathUtils.clamp(k.current * 6 - i, 0, 1);
      m.scale.setScalar(Math.max(0.001, show));
      m.position.set(-1.6 + i * 0.65, -1.7 + Math.sin(i * 0.9) * 0.08, -0.6);
      m.rotation.y += dt * 0.4;
    });
  });
  const colors = eve ? [p.ok, p.ok, p.bad, p.ok, p.warn, p.ok] : [p.ok, p.ok, p.ok, p.brand2, p.ok, p.ok];
  return (
    <group>
      {colors.map((c, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
          <boxGeometry args={[0.42, 0.42, 0.42]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** `eve` = show the eavesdropper being caught at the detect stage (the landing story); off for a clean verdict. */
export default function StoryScene({ stage, height = "100%", eve = true }: { stage: number; height?: number | string; eve?: boolean }) {
  const p = usePalette();
  return (
    <SceneCanvas camera={{ position: [0, 0.9, 7], fov: 42 }} style={{ height }}>
      <ambientLight intensity={p.dark ? 0.55 : 0.95} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <pointLight position={[0, 2, 3]} color={p.brand} intensity={p.dark ? 16 : 7} />
      <Node at={SIGNER} color={p.brand} label="signer · alice" />
      <Node at={VERIFIER} color={eve && stage >= 4 && stage < 5 ? p.warn : p.brand2} label="verifier · bob" />
      <Beam stage={stage} />
      <Qubits stage={stage} eve={eve} />
      <DetectorRings stage={stage} eve={eve} />
      {eve && <Eve stage={stage} />}
      <LedgerStack stage={stage} eve={eve} />
    </SceneCanvas>
  );
}
