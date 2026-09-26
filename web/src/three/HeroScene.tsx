// Landing hero: an entangled core. Two photons orbit a crystalline "sentinel" in perfect
// anti-correlation, six detector rings turn around it, and a field of qubits drifts behind.
// Scrolling dollies the camera out and spreads the rings; the pointer adds parallax.
import { Float, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useScroll } from "@/fx/SmoothScroll";
import { SceneCanvas } from "./common";

const C = { brand: "#6d8bff", cyan: "#22d3ee", violet: "#a78bfa", white: "#eef2ff", bad: "#fb7185" };

function Field({ count = 1400 }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [new THREE.Color(C.brand), new THREE.Color(C.cyan), new THREE.Color(C.violet), new THREE.Color(C.white)];
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 18;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th) - 6], i * 3);
      palette[i % 4].toArray(col, i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.012;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.85} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Photon({ phase, color }: { phase: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.9 + phase;
    const r = 1.9;
    ref.current?.position.set(Math.cos(t) * r, Math.sin(t * 2) * 0.35, Math.sin(t) * r);
    if (trail.current) trail.current.rotation.z = t;
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Entanglement() {
  // A shimmering line between the two photons (they are always opposite each other).
  const ref = useRef<THREE.Line>(null);
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), []);
  const line = useMemo(() => new THREE.Line(geo, new THREE.LineBasicMaterial({ color: C.white, transparent: true, opacity: 0.35 })), [geo]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.9;
    const r = 1.9;
    const a = new THREE.Vector3(Math.cos(t) * r, Math.sin(t * 2) * 0.35, Math.sin(t) * r);
    const b = new THREE.Vector3(Math.cos(t + Math.PI) * r, Math.sin((t + Math.PI) * 2) * 0.35, Math.sin(t + Math.PI) * r);
    geo.setFromPoints([a, b]);
    (line.material as THREE.LineBasicMaterial).opacity = 0.2 + 0.2 * Math.sin(clock.elapsedTime * 3) ** 2;
  });
  return <primitive ref={ref} object={line} />;
}

function Rings() {
  const group = useRef<THREE.Group>(null);
  const rings = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    r: 1.25 + i * 0.2, tilt: [(i * 0.9) % Math.PI, (i * 1.7) % Math.PI, 0] as [number, number, number],
    color: [C.brand, C.cyan, C.violet, C.brand, C.cyan, C.violet][i], speed: 0.15 + i * 0.05,
  })), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    const p = useScroll.getState().progress;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.x += dt * rings[i].speed;
      m.rotation.y += dt * rings[i].speed * 0.6;
      const s = 1 + Math.min(p * 6, 1) * (0.35 + i * 0.08);
      m.scale.setScalar(s);
    });
  });
  return (
    <group ref={group}>
      {rings.map((r, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} rotation={r.tilt}>
          <torusGeometry args={[r.r, 0.009, 8, 160]} />
          <meshBasicMaterial color={r.color} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Core() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ pointer }, dt) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.y += dt * 0.25;
    g.rotation.x += (pointer.y * 0.3 - g.rotation.x) * 0.05;
    g.rotation.z += (-pointer.x * 0.2 - g.rotation.z) * 0.05;
  });
  return (
    <group ref={ref}>
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh>
          <icosahedronGeometry args={[0.72, 0]} />
          <meshStandardMaterial color="#1b2a6b" emissive={C.brand} emissiveIntensity={0.9} metalness={0.6} roughness={0.2} flatShading />
        </mesh>
        <mesh scale={1.28}>
          <icosahedronGeometry args={[0.72, 1]} />
          <meshBasicMaterial color={C.cyan} wireframe transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <mesh scale={0.34}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color={C.white} toneMapped={false} />
        </mesh>
      </Float>
    </group>
  );
}

function Rig() {
  useFrame(({ camera, pointer }) => {
    const p = useScroll.getState().progress;
    const k = Math.min(p * 5, 1);
    const z = 6.2 + k * 3.5;
    camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (pointer.y * 0.4 + k * 1.2 - camera.position.y) * 0.04;
    camera.position.z += (z - camera.position.z) * 0.06;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene() {
  return (
    <SceneCanvas camera={{ position: [0, 0, 6.2], fov: 45 }}>
      <color attach="background" args={["#050814"]} />
      <fog attach="fog" args={["#050814", 8, 26]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} color={C.cyan} intensity={30} />
      <pointLight position={[-4, -2, 2]} color={C.violet} intensity={25} />
      <Field />
      <Sparkles count={60} scale={[9, 5, 6]} size={2.2} speed={0.35} color={C.cyan} />
      <group position={[1.9, 0.1, 0]}>
        <Core />
        <Rings />
        <Photon phase={0} color={C.cyan} />
        <Photon phase={Math.PI} color={C.violet} />
        <Entanglement />
      </group>
      <Rig />
      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.3} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.75} />
      </EffectComposer>
    </SceneCanvas>
  );
}
