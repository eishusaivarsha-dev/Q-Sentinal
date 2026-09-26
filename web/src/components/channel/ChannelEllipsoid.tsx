// The Bloch sphere made meaningful (docs/frontend-spec.md §7.2), drawn as a cel-shaded brass
// armillary. Semi-axes are exactly 1 - 2 x (error rate in that basis). Ghost wireframe = frozen
// baseline. Bloch X -> three.js x, Y -> z, Z -> y (up). The axis with the largest excess Pauli glows.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Pauli, Rates } from "@/api/types";
import { ellipsoidAxes } from "@/lib/physics";

const BASIS = { Z: 0x38bdf8, X: 0xa78bfa, Y: 0x34d399 };
const DIRS = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 0, 1), Z: new THREE.Vector3(0, 1, 0) };

function labelSprite(text: string, color = "#e9dcc0") {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.font = '36px "DM Serif Display", Georgia, serif';
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 64, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(0.42, 0.21, 1);
  return s;
}

function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([60, 150, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

const toThree = (a: { x: number; y: number; z: number }) =>
  new THREE.Vector3(Math.max(0.02, Math.abs(a.x)), Math.max(0.02, Math.abs(a.z)), Math.max(0.02, Math.abs(a.y)));

export default function ChannelEllipsoid({ rates, baseline, excess, alarm = false, height = 380 }: {
  rates: Rates | null; baseline: Rates | null; excess?: Pauli | null; alarm?: boolean; height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ rates, baseline, excess, alarm });
  live.current = { rates, baseline, excess, alarm };

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(2.6, 1.7, 3.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 7;
    controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 0.6;

    scene.add(new THREE.AmbientLight(0xffe6c0, 0.55));
    const key = new THREE.DirectionalLight(0xffd28a, 1.6);
    key.position.set(3, 4, 2);
    scene.add(key);
    const rim = new THREE.PointLight(0xc8502a, 6, 10);
    rim.position.set(-3, -1, -2);
    scene.add(rim);

    // Armillary rings with inverted-hull ink outlines.
    const brass = new THREE.MeshToonMaterial({ color: 0xd99a3b, gradientMap: toonRamp() });
    const ink = new THREE.MeshBasicMaterial({ color: 0x0c0a07, side: THREE.BackSide });
    for (const rot of [[Math.PI / 2, 0, 0], [0, 0, 0], [0, Math.PI / 2, 0]] as [number, number, number][]) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 10, 128), brass);
      const o = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 128), ink);
      m.rotation.set(...rot);
      o.rotation.set(...rot);
      scene.add(o, m);
    }

    // Basis axes, eigenstate dots (the six states on the unit sphere) and labels.
    const axisMats = {} as Record<"X" | "Y" | "Z", THREE.MeshBasicMaterial>;
    const axisMeshes = {} as Record<"X" | "Y" | "Z", THREE.Mesh>;
    for (const k of ["X", "Y", "Z"] as const) {
      const mat = new THREE.MeshBasicMaterial({ color: BASIS[k], transparent: true, opacity: 0.75 });
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.6, 8), mat);
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), DIRS[k]);
      scene.add(cyl);
      axisMats[k] = mat;
      axisMeshes[k] = cyl;
      for (const s of [1, -1]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: BASIS[k] }));
        dot.position.copy(DIRS[k].clone().multiplyScalar(s));
        scene.add(dot);
      }
    }
    const labels: [string, THREE.Vector3, string][] = [
      ["X", new THREE.Vector3(1.45, 0, 0), "#a78bfa"], ["Y", new THREE.Vector3(0, 0, 1.45), "#34d399"],
      ["|0⟩", new THREE.Vector3(0, 1.42, 0), "#38bdf8"], ["|1⟩", new THREE.Vector3(0, -1.42, 0), "#38bdf8"],
    ];
    for (const [t, p, col] of labels) {
      const s = labelSprite(t, col);
      s.position.copy(p);
      scene.add(s);
    }

    // Ghost (baseline) and now (latest verification).
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xe9dcc0, wireframe: true, transparent: true, opacity: 0.12 }));
    scene.add(ghost);
    const nowMat = new THREE.MeshStandardMaterial({ color: 0xffc15e, emissive: 0xf0a53a, emissiveIntensity: 0.5, transparent: true, opacity: 0.4, roughness: 0.4, depthWrite: false });
    const now = new THREE.Group();
    now.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), nowMat),
      new THREE.Mesh(new THREE.SphereGeometry(1.001, 18, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c9, wireframe: true, transparent: true, opacity: 0.1 })));
    scene.add(now);

    // Photon motes orbiting inside the ellipsoid.
    const pCount = 140;
    const seeds = Float32Array.from({ length: pCount * 3 }, () => Math.random() * 2 - 1);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pCount * 3), 3));
    scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xfff1c9, size: 0.03, transparent: true, opacity: 0.9, depthWrite: false })));

    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let t = 0;
    const cur = new THREE.Vector3(1, 1, 1);
    const tick = () => {
      t += 0.01;
      const { rates: r, baseline: b, excess: ex, alarm: hot } = live.current;
      const target = toThree(ellipsoidAxes(r));
      cur.lerp(target, 0.08);
      if (cur.distanceTo(target) < 1e-4) cur.copy(target);
      now.scale.copy(cur);
      ghost.scale.copy(toThree(ellipsoidAxes(b)));
      nowMat.color.set(hot ? 0xe0513a : 0xffc15e);
      nowMat.emissive.set(hot ? 0xc8502a : 0xf0a53a);
      const top = (Object.entries(ex ?? {}) as [string, number][]).sort((p, q) => q[1] - p[1])[0];
      for (const k of ["X", "Y", "Z"] as const) {
        const glow = !!top && top[1] > 0.005 && top[0] === `p${k}`;
        axisMats[k].color.setHex(glow ? 0xff7a45 : BASIS[k]);
        axisMats[k].opacity = glow ? 1 : 0.75;
        axisMeshes[k].scale.set(glow ? 3 : 1, 1, glow ? 3 : 1);
      }
      const pos = pGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pCount; i++) {
        const a = seeds[i * 3] * Math.PI + t * (0.3 + 0.2 * seeds[i * 3 + 2]);
        const bb = Math.acos(seeds[i * 3 + 1]);
        pos.setXYZ(i, 0.92 * Math.sin(bb) * Math.cos(a) * cur.x, 0.92 * Math.cos(bb) * cur.y, 0.92 * Math.sin(bb) * Math.sin(a) * cur.z);
      }
      pos.needsUpdate = true;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [height]);

  return <div ref={host} style={{ height }} className="relative w-full min-w-0 cursor-grab overflow-hidden active:cursor-grabbing"
    aria-label="Channel ellipsoid: an honest channel is a full sphere; an eavesdropper squashes it" />;
}
