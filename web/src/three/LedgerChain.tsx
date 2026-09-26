// The ledger as a 3-D chain of blocks: verdicts (green / red), Merkle anchors (large, gold) with
// beams down to the verdicts they cover, link baselines and symmetrisation commits. Click a block
// to open it. Colours and hashes all come from GET /ledger.
import { OrbitControls, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LedgerEntry } from "@/api/types";
import { Label, SceneCanvas, usePalette, type Palette } from "./common";

function colorOf(p: Palette, e: LedgerEntry) {
  if (e.kind === "verdict") return e.payload.decision === "REJECT" ? p.bad : p.ok;
  if (e.kind === "merkle_anchor") return p.warn;
  if (e.kind === "link_commissioned") return p.brand2;
  if (e.kind === "analyst_review") return p.brand;
  if (e.kind.startsWith("sym")) return p.violet;
  return p.ink3;
}

const SPACING = 1.25;
const posOf = (i: number, n: number) =>
  new THREE.Vector3((i - (n - 1)) * SPACING, Math.sin(i * 0.55) * 0.28, Math.cos(i * 0.55) * 0.45);

function Block({ e, at, color, selected, onSelect }: { e: LedgerEntry; at: THREE.Vector3; color: string; selected: boolean; onSelect: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const anchor = e.kind === "merkle_anchor";
  const size = anchor ? 0.78 : 0.6;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const lift = selected ? 0.35 : hover ? 0.15 : 0;
    g.position.y += (at.y + lift - g.position.y) * (1 - Math.exp(-dt * 8));
    g.rotation.y += dt * (selected ? 0.9 : 0.15);
    const s = selected ? 1.15 : 1;
    g.scale.lerp(new THREE.Vector3(s, s, s), 1 - Math.exp(-dt * 8));
  });
  return (
    <group ref={ref} position={[at.x, at.y, at.z]}>
      <RoundedBox args={[size, size, size]} radius={0.09} smoothness={4}
        onClick={(ev) => { ev.stopPropagation(); onSelect(); }}
        onPointerOver={(ev) => { ev.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.75 : 0.32} roughness={0.25} metalness={0.15} clearcoat={1} transparent opacity={0.93} />
      </RoundedBox>
      <mesh scale={1.001}>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
      </mesh>
      {(hover || selected) && <Label position={[0, size / 2 + 0.38, 0]} tone={color}>#{e.index} · {e.kind.replace("_", " ")}</Label>}
    </group>
  );
}

function Chain({ entries, selected, onSelect }: { entries: LedgerEntry[]; selected: number | null; onSelect: (e: LedgerEntry) => void }) {
  const p = usePalette();
  const n = entries.length;
  const positions = useMemo(() => entries.map((_, i) => posOf(i, n)), [entries, n]);
  const byIndex = useMemo(() => new Map(entries.map((e, i) => [e.index, i])), [entries]);
  const links = useMemo(() => {
    const segs: THREE.Vector3[] = [];
    for (let i = 1; i < n; i++) segs.push(positions[i - 1], positions[i]);
    return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), new THREE.LineBasicMaterial({ color: p.line, transparent: true, opacity: 0.9 }));
  }, [positions, n, p.line]);
  const beams = useMemo(() => {
    const segs: THREE.Vector3[] = [];
    entries.forEach((e, i) => {
      if (e.kind !== "merkle_anchor") return;
      for (const m of (e.payload.members as number[] | undefined) ?? []) {
        const j = byIndex.get(m);
        if (j !== undefined) segs.push(positions[i].clone().add(new THREE.Vector3(0, 0.45, 0)), positions[j].clone().add(new THREE.Vector3(0, 0.35, 0)));
      }
    });
    return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), new THREE.LineBasicMaterial({ color: p.warn, transparent: true, opacity: 0.55 }));
  }, [entries, byIndex, positions, p.warn]);

  // Glide the camera target to the selected block (or the newest one).
  const { camera } = useThree();
  const focus = useRef(new THREE.Vector3());
  useFrame((state, dt) => {
    const i = selected !== null ? byIndex.get(selected) : n - 1;
    const target = i !== undefined && positions[i] ? positions[i] : new THREE.Vector3();
    focus.current.lerp(target.clone().add(new THREE.Vector3(-1.2, 0, 0)), 1 - Math.exp(-dt * 2.5));
    const controls = state.controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (controls) {
      const delta = focus.current.clone().sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
      controls.update();
    }
  });

  return (
    <group>
      <primitive object={links} />
      <primitive object={beams} />
      {entries.map((e, i) => (
        <Block key={e.index} e={e} at={positions[i]} color={colorOf(p, e)} selected={selected === e.index} onSelect={() => onSelect(e)} />
      ))}
    </group>
  );
}

export default function LedgerChain({ entries, selected, onSelect, height = 340 }: { entries: LedgerEntry[]; selected: number | null; onSelect: (e: LedgerEntry) => void; height?: number }) {
  const p = usePalette();
  return (
    <SceneCanvas camera={{ position: [-1.5, 2.2, 6.4], fov: 42 }} style={{ height }}>
      <ambientLight intensity={p.dark ? 0.55 : 0.95} />
      <directionalLight position={[3, 6, 5]} intensity={1.5} />
      <pointLight position={[-4, 2, 2]} color={p.brand} intensity={10} />
      <Chain entries={entries} selected={selected} onSelect={onSelect} />
      <OrbitControls makeDefault enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 1.9} />
    </SceneCanvas>
  );
}
