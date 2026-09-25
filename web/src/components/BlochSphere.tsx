import { useEffect, useRef } from "react";
import * as THREE from "three";

// Starter Bloch sphere with the six Pauli eigenstates marked.
// TODO(frontend-lead): animate the state vector of the round being verified (from telemetry).
const EIGENSTATES: [string, [number, number, number], number][] = [
  ["|0>", [0, 1, 0], 0x38bdf8],
  ["|1>", [0, -1, 0], 0x38bdf8],
  ["|+>", [1, 0, 0], 0xa78bfa],
  ["|->", [-1, 0, 0], 0xa78bfa],
  ["|+i>", [0, 0, 1], 0x34d399],
  ["|-i>", [0, 0, -1], 0x34d399],
];

export default function BlochSphere() {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mount.current!;
    const w = el.clientWidth;
    const h = 260;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(2.2, 1.4, 2.6);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true, transparent: true, opacity: 0.35 }),
      ),
    );
    for (const [, [x, y, z], color] of EIGENSTATES) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color }));
      dot.position.set(x, y, z);
      group.add(dot);
    }
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xf43f5e);
    group.add(arrow);
    scene.add(group);

    let frame = 0;
    const tick = () => {
      group.rotation.y += 0.004;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-2 font-medium">Bloch sphere</h2>
      <div ref={mount} className="w-full" />
      <p className="text-xs text-slate-500">
        Blue: Z basis · purple: X basis · green: Y basis (six-state encoding)
      </p>
    </section>
  );
}
