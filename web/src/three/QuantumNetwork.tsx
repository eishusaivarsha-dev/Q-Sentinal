// Mission Control's live 3-D network: the signer, every verifier, and the quantum links between
// them. Photons stream along each link; its colour is the link's health from GET /links. When a
// link is under attack an eavesdropper node appears tapping it. Click a link to inspect it.
import { Float, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LinkHealth } from "@/api/types";
import { Label, SceneCanvas, usePalette, type Palette } from "./common";

export interface NetLink { name: string; from: string; to: string; status: LinkHealth }

function statusColor(p: Palette, s: LinkHealth) {
  return s === "critical" ? p.bad : s === "warning" ? p.warn : s === "healthy" ? p.brand2 : p.ink3;
}

function layout(links: NetLink[]) {
  const signers = [...new Set(links.map((l) => l.from))];
  const verifiers = [...new Set(links.map((l) => l.to))];
  const pos = new Map<string, THREE.Vector3>();
  signers.forEach((s, i) => pos.set(s, new THREE.Vector3(-2.3, (i - (signers.length - 1) / 2) * 1.4, 0)));
  verifiers.forEach((v, i) => {
    const a = verifiers.length === 1 ? 0 : (i / (verifiers.length - 1) - 0.5) * 1.6;
    pos.set(v, new THREE.Vector3(1.4 + Math.cos(a) * 1.1, Math.sin(a) * 2.1, Math.sin(a * 1.7) * 0.9));
  });
  return { pos, signers, verifiers };
}

function Node({ at, color, size, label, role }: { at: THREE.Vector3; color: string; size: number; label: string; role: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.6;
  });
  return (
    <group position={at}>
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.35}>
        <mesh>
          <sphereGeometry args={[size * 0.8, 32, 32]} />
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.15} metalness={0.2} clearcoat={1} />
        </mesh>
        <mesh scale={1.55}>
          <icosahedronGeometry args={[size, 1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.28} />
        </mesh>
        <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[size * 2.1, 0.012, 8, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} />
        </mesh>
      </Float>
      <Label position={[0, -size - 0.42, 0]}>{label} <span className="font-sans font-medium text-ink-3">· {role}</span></Label>
    </group>
  );
}

function Link3D({ curve, color, status, onPick, name, eve }: { curve: THREE.QuadraticBezierCurve3; color: string; status: LinkHealth; onPick?: (n: string) => void; name: string; eve: boolean }) {
  const p = usePalette();
  const [hover, setHover] = useState(false);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 64, hover ? 0.035 : 0.022, 10, false), [curve, hover]);
  const photons = useRef<THREE.InstancedMesh>(null);
  const N = 9;
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const colA = useMemo(() => new THREE.Color(color), [color]);
  const colBad = useMemo(() => new THREE.Color(p.bad), [p.bad]);
  useLayoutEffect(() => {
    const m = photons.current;
    if (!m) return;
    for (let i = 0; i < N; i++) m.setColorAt(i, colA);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [colA]);
  useFrame(({ clock }) => {
    const m = photons.current;
    if (!m) return;
    const speed = status === "critical" ? 0.16 : 0.22;
    for (let i = 0; i < N; i++) {
      const t = (clock.elapsedTime * speed + i / N) % 1;
      tmp.position.copy(curve.getPoint(t));
      const s = 0.055 + Math.sin(t * Math.PI) * 0.04;
      tmp.scale.setScalar(s / 0.06);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, eve && t > 0.55 ? colBad : colA);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={tube} onClick={(e) => { e.stopPropagation(); onPick?.(name); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.9 : 0.45} transparent opacity={0.85} />
      </mesh>
      <instancedMesh ref={photons} args={[undefined, undefined, N]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function Eve({ at, target }: { at: THREE.Vector3; target: THREE.Vector3 }) {
  const p = usePalette();
  const body = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const line = useMemo(() => new THREE.BufferGeometry().setFromPoints([at, target]), [at, target]);
  useFrame(({ clock }, dt) => {
    if (body.current) { body.current.rotation.y += dt * 1.4; body.current.rotation.x += dt * 0.6; }
    if (pulse.current) {
      const k = (clock.elapsedTime * 0.9) % 1;
      pulse.current.scale.setScalar(1 + k * 2.2);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
    }
  });
  return (
    <group>
      <lineSegments geometry={line} onUpdate={(self) => self.computeLineDistances()}>
        <lineDashedMaterial color={p.bad} dashSize={0.08} gapSize={0.06} />
      </lineSegments>
      <group position={at}>
        <mesh ref={body}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color={p.bad} emissive={p.bad} emissiveIntensity={0.8} flatShading />
        </mesh>
        <mesh ref={pulse} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.27, 48]} />
          <meshBasicMaterial color={p.bad} transparent side={THREE.DoubleSide} />
        </mesh>
        <Label position={[0, -0.5, 0]} tone={p.bad}>eavesdropper?</Label>
      </group>
    </group>
  );
}

function Network({ links, onPick }: { links: NetLink[]; onPick?: (n: string) => void }) {
  const p = usePalette();
  const { pos, signers, verifiers } = useMemo(() => layout(links), [links]);
  const curves = useMemo(() => links.map((l) => {
    const a = pos.get(l.from)!;
    const b = pos.get(l.to)!;
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.9, 0.6));
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }), [links, pos]);
  const grid = useMemo(() => {
    const g = new THREE.PolarGridHelper(5, 12, 6, 64, p.line, p.line);
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = p.dark ? 0.35 : 0.55;
    return g;
  }, [p.line, p.dark]);
  return (
    <group rotation={[0.18, -0.25, 0]}>
      <primitive object={grid} position={[0, -2.2, 0]} />
      {links.map((l, i) => (
        <Link3D key={l.name} name={l.name} curve={curves[i]} color={statusColor(p, l.status)} status={l.status} onPick={onPick} eve={l.status === "critical"} />
      ))}
      {links.map((l, i) => l.status === "critical" && (
        <Eve key={`eve-${l.name}`} at={curves[i].getPoint(0.55).add(new THREE.Vector3(0.25, -1.05, 0.55))} target={curves[i].getPoint(0.55)} />
      ))}
      {signers.map((s) => <Node key={s} at={pos.get(s)!} color={p.brand} size={0.3} label={s} role="signer" />)}
      {verifiers.map((v) => {
        const st = links.filter((l) => l.to === v).map((l) => l.status);
        const c = st.includes("critical") ? p.bad : st.includes("warning") ? p.warn : p.brand2;
        return <Node key={v} at={pos.get(v)!} color={c} size={0.22} label={v} role="verifier" />;
      })}
    </group>
  );
}

export default function QuantumNetwork({ links, onPick, height = 420 }: { links: NetLink[]; onPick?: (n: string) => void; height?: number }) {
  const p = usePalette();
  const shown = links.length ? links : [{ name: "alice->bob", from: "alice", to: "bob", status: "idle" as LinkHealth }];
  return (
    <SceneCanvas camera={{ position: [0, 0.5, 6.3], fov: 42 }} style={{ height }}>
      <ambientLight intensity={p.dark ? 0.5 : 0.9} />
      <directionalLight position={[4, 6, 5]} intensity={p.dark ? 1.2 : 1.6} />
      <pointLight position={[-3, 2, 3]} color={p.brand} intensity={p.dark ? 18 : 8} />
      <Network links={shown} onPick={onPick} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.45} minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 1.8} />
    </SceneCanvas>
  );
}
