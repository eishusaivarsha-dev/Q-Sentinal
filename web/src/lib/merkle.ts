// In-browser Merkle inclusion check, same construction as qsentinel/ledger/merkle.py (RFC 6962
// style, SHA3-256, 0x00 leaf / 0x01 node prefixes). Lets anyone verify a proof without trusting us.
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const leaf = (data: Uint8Array) => sha3_256(concat(new Uint8Array([0]), data));
const node = (l: Uint8Array, r: Uint8Array) => sha3_256(concat(new Uint8Array([1]), l, r));

export interface ProofStep { side: string; sibling: string; result: string }

/** Recomputes the root from the leaf and audit path; returns every intermediate hash. */
export function walkProof(leafHex: string, proof: [string, string][]): ProofStep[] {
  let h = leaf(hexToBytes(leafHex));
  const steps: ProofStep[] = [{ side: "leaf", sibling: "", result: bytesToHex(h) }];
  for (const [side, sib] of proof) {
    const s = hexToBytes(sib);
    h = side === "L" ? node(s, h) : node(h, s);
    steps.push({ side, sibling: sib, result: bytesToHex(h) });
  }
  return steps;
}

export function verifyProof(leafHex: string, proof: [string, string][], root: string): boolean {
  const steps = walkProof(leafHex, proof);
  return steps[steps.length - 1].result === root;
}
