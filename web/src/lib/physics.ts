// Display-only maths (docs/frontend-spec.md §7). The backend's numbers are the ground truth;
// these formulas draw them and power the interactive Security Bounds calculator.
import type { LinkStatus, Pauli, Rates } from "@/api/types";

export const CLASSICAL_S = 2;
export const TSIRELSON_S = 2 * Math.SQRT2;

/** A Pauli channel squashes the Bloch sphere into an ellipsoid with axis_b = 1 - 2 x errorRate_b (exact). */
export function ellipsoidAxes(r: Rates | null | undefined) {
  return r ? { x: 1 - 2 * r.X, y: 1 - 2 * r.Y, z: 1 - 2 * r.Z } : { x: 1, y: 1, z: 1 };
}

/** Human name for the ellipsoid's shape: sphere, uniform shrink, or a cigar/pancake along an axis. */
export function ellipsoidShape(r: Rates | null | undefined): string {
  const a = ellipsoidAxes(r);
  const v = [a.x, a.y, a.z];
  const names = ["X", "Y", "Z"];
  const max = Math.max(...v);
  const min = Math.min(...v);
  if (max - min < 0.02) return max > 0.97 ? "Pristine sphere" : "Uniform shrink";
  const hi = v.indexOf(max);
  if (v.every((x, i) => i === hi || max - x > 0.02)) return `${names[hi]}-cigar`;
  return `${names[v.indexOf(min)]}-pancake`;
}

export function baselineRates(l: LinkStatus): Rates {
  const r = (k: string) => (l.baseline.per_basis[k] ? l.baseline.per_basis[k][0] / (l.baseline.per_basis[k][1] || 1) : 0);
  return { Z: r("0"), X: r("1"), Y: r("2") };
}

export function pauliOf(r: Rates): Pauli {
  const c = (x: number) => Math.max(0, x);
  return { pX: c((r.Z + r.Y - r.X) / 2), pY: c((r.Z + r.X - r.Y) / 2), pZ: c((r.X + r.Y - r.Z) / 2) };
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
