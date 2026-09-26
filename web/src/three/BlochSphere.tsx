// A 3-D Bloch sphere. Used twice:
//  - Teleport Lab: state arrows (input / received / corrected) glide to their Bloch vectors.
//  - Channel Observatory: the channel ellipsoid - a Pauli channel squashes the sphere to semi-axes
//    1 - 2 * (error rate) per basis, so its shape shows how an eavesdropper is listening.
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Label, SceneCanvas, usePalette } from "./common";

export interface Arrow { key: string; vec: [number, number, number]; color: string; label?: string; width?: number; opacity?: number }
export interface Axes { x: number; y: number; z: number }

// Physics (x, y, z) -> scene: Z up, X toward the viewer-right, Y into the screen.
const toScene = (v: [number, number, number]) => new THREE.Vector3(v[0], v[2], -v[1]);

function StateArrow({ a }: { a: Arrow }) {
  const group = useRef<THREE.Group>(null);
  const cur = useRef(new THREE.Vector3(0, 1, 0));
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const tip = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const target = toScene(a.vec);
    cur.current.lerp(target, 1 - Math.exp(-dt * 5));
    const len = Math.max(cur.current.length(), 1e-4);
    const dir = cur.current.clone().normalize();
    group.current?.quaternion.setFromUnitVectors(up, dir);
    if (shaft.current) { shaft.current.scale.set(1, Math.max(len - 0.14, 0.001), 1); shaft.current.position.y = Math.max(len - 0.14, 0.001) / 2; }
    if (head.current) head.current.position.y = Math.max(len - 0.07, 0.07);
    if (tip.current) tip.current.position.copy(cur.current);
  });
  const w = a.width ?? 0.022;
  return (
    <>
      <group ref={group}>
        <mesh ref={shaft}>
          <cylinderGeometry args={[w, w, 1, 12]} />
          <meshStandardMaterial color={a.color} emissive={a.color} emissiveIntensity={0.6} transparent opacity={a.opacity ?? 1} />
        </mesh>
        <mesh ref={head}>
          <coneGeometry args={[w * 3.2, 0.14, 20]} />
          <meshStandardMaterial color={a.color} emissive={a.color} emissiveIntensity={0.6} transparent opacity={a.opacity ?? 1} />
        </mesh>
      </group>
      <mesh ref={tip}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color={a.color} transparent opacity={a.opacity ?? 1} />
      </mesh>
    </>
  );
}

function Sphere({ arrows, ellipsoid, ghost, hotAxis, alarm }: { arrows: Arrow[]; ellipsoid?: Axes | null; ghost?: Axes | null; hotAxis?: "x" | "y" | "z" | null; alarm?: boolean }) {
  const p = usePalette();
  const ell = useRef<THREE.Mesh>(null);
  const scale = useRef(new THREE.Vector3(1, 1, 1));
  useFrame((_, dt) => {
    if (!ell.current || !ellipsoid) return;
    // Scene axes: x -> X, y -> Z, z -> Y (see toScene).
    const target = new THREE.Vector3(Math.max(ellipsoid.x, 0.02), Math.max(ellipsoid.z, 0.02), Math.max(ellipsoid.y, 0.02));
    scale.current.lerp(target, 1 - Math.exp(-dt * 3));
    ell.current.scale.copy(scale.current);
  });
  const rings = useMemo(() => [0, 1, 2].map((k) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      pts.push(k === 0 ? new THREE.Vector3(Math.cos(t), 0, Math.sin(t)) : k === 1 ? new THREE.Vector3(Math.cos(t), Math.sin(t), 0) : new THREE.Vector3(0, Math.cos(t), Math.sin(t)));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: p.line, transparent: true, opacity: 0.9 }));
  }), [p.line]);
  const axes = useMemo(() => {
    const color = { x: p.violet, y: p.ok, z: p.brand };
    const dirs: [("x" | "y" | "z"), THREE.Vector3][] = [["x", new THREE.Vector3(1, 0, 0)], ["y", new THREE.Vector3(0, 0, -1)], ["z", new THREE.Vector3(0, 1, 0)]];
    return dirs.map(([key, d]) => new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([d.clone().multiplyScalar(-1.25), d.clone().multiplyScalar(1.25)]),
      new THREE.LineBasicMaterial({ color: color[key], transparent: true, opacity: hotAxis === key ? 1 : 0.6 })));
  }, [p.violet, p.ok, p.brand, hotAxis]);
  const ellColor = alarm ? p.bad : p.brand;
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhysicalMaterial color={p.dark ? "#1b2550" : "#dfe6ff"} transparent opacity={p.dark ? 0.16 : 0.28} roughness={0.2} clearcoat={1} depthWrite={false} />
      </mesh>
      {rings.map((l, i) => <primitive key={`r${i}`} object={l} />)}
      {axes.map((l, i) => <primitive key={`a${i}`} object={l} />)}
      {ghost && (
        <mesh scale={[ghost.x, ghost.z, ghost.y]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color={p.ink3} wireframe transparent opacity={0.18} />
        </mesh>
      )}
      {ellipsoid && (
        <mesh ref={ell}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial color={ellColor} emissive={ellColor} emissiveIntensity={0.35} transparent opacity={0.42} roughness={0.35} depthWrite={false} />
        </mesh>
      )}
      {hotAxis && (
        <mesh rotation={hotAxis === "x" ? [0, 0, Math.PI / 2] : hotAxis === "y" ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2.6, 12]} />
          <meshBasicMaterial color={p.bad} transparent opacity={0.85} />
        </mesh>
      )}
      {arrows.map((a) => <StateArrow key={a.key} a={a} />)}
      <Label position={[0, 1.42, 0]}>|0⟩</Label>
      <Label position={[0, -1.42, 0]}>|1⟩</Label>
      <Label position={[1.45, 0, 0]} tone={p.violet}>|+⟩</Label>
      <Label position={[-1.45, 0, 0]} tone={p.violet}>|−⟩</Label>
      <Label position={[0, 0, -1.45]} tone={p.ok}>|+i⟩</Label>
      <Label position={[0, 0, 1.45]} tone={p.ok}>|−i⟩</Label>
    </group>
  );
}

export default function BlochSphere({ arrows = [], ellipsoid, ghost, hotAxis, alarm, height = 380, autoRotate = true }: {
  arrows?: Arrow[]; ellipsoid?: Axes | null; ghost?: Axes | null; hotAxis?: "x" | "y" | "z" | null; alarm?: boolean; height?: number; autoRotate?: boolean;
}) {
  const p = usePalette();
  return (
    <SceneCanvas camera={{ position: [2.6, 1.7, 3.4], fov: 40 }} style={{ height }}>
      <ambientLight intensity={p.dark ? 0.6 : 1} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <pointLight position={[-3, -2, 2]} color={p.brand2} intensity={6} />
      <Sphere arrows={arrows} ellipsoid={ellipsoid} ghost={ghost} hotAxis={hotAxis} alarm={alarm} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.8} />
    </SceneCanvas>
  );
}
