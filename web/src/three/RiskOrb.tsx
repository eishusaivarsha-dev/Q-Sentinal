// Fraud Review's risk orb: a liquid core whose turbulence, spin and colour follow the advisory
// risk score (calm blue sphere at 0, a boiling red one at 100). Orbiting shards = the reasons the
// AI gave; a gold ring appears once the analyst has signed a decision onto the ledger.
import { Float, MeshDistortMaterial, OrbitControls, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SceneCanvas, usePalette } from "./common";

function Core({ risk, color }: { risk: number; color: string }) {
  // drei's DistortMaterialImpl type isn't exported; the instance exposes `distort` and `speed`.
  const mat = useRef<{ distort: number; speed: number }>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const k = useRef(0);
  useFrame((_, dt) => {
    k.current += (risk / 100 - k.current) * (1 - Math.exp(-dt * 2.5));
    if (mat.current) {
      mat.current.distort = 0.12 + k.current * 0.48;
      mat.current.speed = 1 + k.current * 4;
    }
    if (mesh.current) mesh.current.rotation.y += dt * (0.2 + k.current * 1.2);
  });
  return (
    <Float speed={1.6} floatIntensity={0.5} rotationIntensity={0.4}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1, 24]} />
        <MeshDistortMaterial ref={mat as never} color={color} emissive={color} emissiveIntensity={0.45} roughness={0.18} metalness={0.25} />
      </mesh>
    </Float>
  );
}

function Shards({ count, color }: { count: number; color: string }) {
  const group = useRef<THREE.Group>(null);
  const items = useMemo(() => Array.from({ length: Math.max(count, 1) }, (_, i) => ({
    r: 1.75 + (i % 2) * 0.28, phase: (i / Math.max(count, 1)) * Math.PI * 2, tilt: 0.35 + i * 0.22,
  })), [count]);
  useFrame(({ clock }) => {
    group.current?.children.forEach((m, i) => {
      const it = items[i];
      const t = clock.elapsedTime * 0.55 + it.phase;
      m.position.set(Math.cos(t) * it.r, Math.sin(t * 1.3) * it.tilt, Math.sin(t) * it.r);
      m.rotation.x = t * 2;
      m.rotation.y = t * 1.4;
    });
  });
  return (
    <group ref={group}>
      {items.slice(0, count).map((_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[0.11, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function SealRing({ on, color }: { on: boolean; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const s = useRef(0);
  useFrame((_, dt) => {
    s.current += ((on ? 1 : 0) - s.current) * (1 - Math.exp(-dt * 4));
    if (ref.current) {
      ref.current.scale.setScalar(Math.max(0.001, s.current));
      ref.current.rotation.z += dt * 0.5;
    }
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2.3, 0, 0]}>
      <torusGeometry args={[1.45, 0.025, 12, 128]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

export default function RiskOrb({ risk, reasons, decided, height = 300 }: { risk: number; reasons: number; decided: boolean; height?: number }) {
  const p = usePalette();
  const color = risk >= 75 ? p.bad : risk >= 50 ? p.warn : risk >= 25 ? p.violet : p.brand2;
  return (
    <SceneCanvas camera={{ position: [0, 0.4, 5], fov: 42 }} style={{ height }}>
      <ambientLight intensity={p.dark ? 0.5 : 0.9} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <pointLight position={[-3, -2, 2]} color={color} intensity={p.dark ? 20 : 9} />
      <Core risk={risk} color={color} />
      <Shards count={Math.min(reasons, 8)} color={color} />
      <SealRing on={decided} color={p.warn} />
      <Sparkles count={30 + Math.round(risk / 2)} scale={[5, 3.5, 4]} size={2} speed={0.2 + risk / 150} color={color} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.6} />
    </SceneCanvas>
  );
}
