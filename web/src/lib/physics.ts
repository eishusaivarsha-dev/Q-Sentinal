// Display-only maths (docs/frontend-spec.md §7). The backend's numbers are the ground truth;
// these formulas draw them and power the interactive Security Bounds calculator.
import type { Rates } from "../api/types";

/** A Pauli channel squashes the Bloch sphere into an ellipsoid with axis_b = 1 - 2 * errorRate_b. */
export function ellipsoidAxes(r: Rates | null | undefined) {
  const f = (x: number) => Math.min(1, Math.max(0.04, 1 - 2 * x));
  return r ? { x: f(r.X), y: f(r.Y), z: f(r.Z) } : { x: 1, y: 1, z: 1 };
}

export const chsh = (zz: number, xx: number) => Math.SQRT2 * (zz + xx);
export const fidelity = (zz: number, xx: number, yy: number) => (1 + xx - yy + zz) / 4;

export function kl(a: number, p: number) {
  const t = (x: number, y: number) => (x === 0 ? 0 : x * Math.log(x / y));
  return t(a, p) + t(1 - a, 1 - p);
}

/** log10 of the Chernoff bound exp(-n KL(tau||q)). */
export function log10Chernoff(n: number, tau: number, q: number) {
  return tau >= q ? 0 : (-n * kl(tau, q)) / Math.LN10;
}

function logGamma(z: number): number {
  // Lanczos approximation (g = 7), accurate to ~1e-13 for z > 0.
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** log10 P[Bin(n, q) <= floor(tau*n)] via log-sum-exp (exact forger pass probability). */
export function log10ExactForgery(n: number, tau: number, q: number) {
  const k = Math.floor(tau * n);
  const terms: number[] = [];
  for (let i = 0; i <= k; i++) {
    terms.push(logGamma(n + 1) - logGamma(i + 1) - logGamma(n - i + 1) + i * Math.log(q) + (n - i) * Math.log(1 - q));
  }
  const m = Math.max(...terms);
  return (m + Math.log(terms.reduce((s, t) => s + Math.exp(t - m), 0))) / Math.LN10;
}

export function sci(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  if (x === 0) return "0";
  if (Math.abs(x) >= 1e-3 && Math.abs(x) < 1e4) return x.toPrecision(3);
  const e = Math.floor(Math.log10(Math.abs(x)));
  return `${(x / 10 ** e).toFixed(digits)} × 10^${e}`;
}

export function sciFromLog10(l: number): string {
  if (l > -3) return (10 ** l).toPrecision(3);
  const e = Math.floor(l);
  return `${(10 ** (l - e)).toFixed(2)} × 10^${e}`;
}

export const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? "–" : `${(x * 100).toFixed(d)}%`);

export function ago(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}
