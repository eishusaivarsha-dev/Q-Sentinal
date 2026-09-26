// Number and time formatting. Backend timestamps are UNIX seconds.

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (e: number) => String(e).split("").map((c) => SUP[c]).join("");

/** 3.20 × 10⁻¹² style. */
export function sci(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  if (!Number.isFinite(x)) return "∞";
  if (x === 0) return "0";
  if (Math.abs(x) >= 1e-3 && Math.abs(x) < 1e4) return x.toPrecision(3);
  const e = Math.floor(Math.log10(Math.abs(x)));
  return `${(x / 10 ** e).toFixed(digits)} × 10${sup(e)}`;
}

export function sciFromLog10(l: number): string {
  if (l > -3) return (10 ** l).toPrecision(3);
  const e = Math.floor(l);
  return `${(10 ** (l - e)).toFixed(2)} × 10${sup(e)}`;
}

export const pct = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? "–" : `${(x * 100).toFixed(d)}%`;

export const shortHash = (h: string | null | undefined, n = 8) => (!h ? "—" : h.length > 2 * n ? `${h.slice(0, n)}…${h.slice(-4)}` : h);

export function clock(tsSec: number): string {
  return new Date(tsSec * 1000).toLocaleTimeString("en-GB", { hour12: false });
}

export function stamp(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return `${d.toISOString().slice(0, 10)} ${clock(tsSec)}`;
}

export function ago(tsSec: number): string {
  const s = Math.max(0, Date.now() / 1000 - tsSec);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

/** Case-file number shown on certificates: derived from the ledger index. */
export const docket = (ledgerIndex: number) => `QS-${String(ledgerIndex).padStart(5, "0")}`;

export const attackName = (name: string) => name.replaceAll("_", " ");
