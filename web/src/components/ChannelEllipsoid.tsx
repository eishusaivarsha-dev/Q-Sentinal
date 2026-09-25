// The Bloch sphere made meaningful (docs/frontend-spec.md §7.2): the channel squashes the sphere
// into an ellipsoid whose semi-axes are 1 - 2 x (error rate in that basis). Ghost = frozen baseline.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Pauli, Rates } from "../api/types";
import { ellipsoidAxes } from "../lib/physics";

const COLORS = { Z: 0x38bdf8, X: 0xa78bfa, Y: 0x34d399 };

export default function ChannelEllipsoid({ rates, baseline, excess, height = 320 }: {
  rates: Rates | null; baseline: Rates | null; excess?: Pauli | null; height?: number;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const meshes = useRef<{ now: THREE.Mesh; ghost: THREE.Mesh; axes: Record<"X" | "Y" | "Z", THREE.Mesh> } | null>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(2.6, 1.6, 3.0);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.9);
    light.position.set(3, 4, 2);
    scene.add(light);

    const group = new THREE.Group();
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true, transparent: true, opacity: 0.35 }));
    const now = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.45, roughness: 0.4 }));
    group.add(ghost, now);
    // Bloch axes: Z vertical (three.js y), X -> x, Y -> z.
    const axisMesh = (dir: THREE.Vector3, color: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.5, 8), new THREE.MeshBasicMaterial({ color }));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      group.add(m);
      for (const s of [1, -1]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color }));
        dot.position.copy(dir.clone().multiplyScalar(s));
        group.add(dot);
      }
      return m;
    };
    const axes = {
      Z: axisMesh(new THREE.Vector3(0, 1, 0), COLORS.Z),
      X: axisMesh(new THREE.Vector3(1, 0, 0), COLORS.X),
      Y: axisMesh(new THREE.Vector3(0, 0, 1), COLORS.Y),
    };
    scene.add(group);
    meshes.current = { now, ghost, axes };

    const resize = () => {
      const w = el.clientWidth || 300;
      renderer.setSize(w, height);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let frame = 0;
    const tick = () => {
      group.rotation.y += 0.003;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      meshes.current = null;
    };
  }, [height]);

  useEffect(() => {
    const m = meshes.current;
    if (!m) return;
    const a = ellipsoidAxes(rates);
    const g = ellipsoidAxes(baseline);
    m.now.scale.set(a.x, a.z, a.y);
    m.ghost.scale.set(g.x, g.z, g.y);
    // Glow the axis Eve is probing: the Pauli with the largest excess.
    const ex = excess ?? { pX: 0, pY: 0, pZ: 0 };
    const top = (Object.entries(ex) as [keyof Pauli, number][]).sort((p, q) => q[1] - p[1])[0];
    for (const k of ["X", "Y", "Z"] as const) {
      const hot = top && top[1] > 0.005 && top[0] === `p${k}`;
      const mat = m.axes[k].material as THREE.MeshBasicMaterial;
      mat.color.setHex(hot ? 0xfb923c : COLORS[k]);
      m.axes[k].scale.set(hot ? 3 : 1, 1, hot ? 3 : 1);
    }
  }, [rates, baseline, excess]);

  return <div ref={mount} className="w-full" style={{ height }} aria-label="Channel ellipsoid: honest channel is a full sphere; an eavesdropper squashes it" />;
}
