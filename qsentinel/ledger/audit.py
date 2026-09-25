"""Ledger auditor: everything an external party can check with only the ledger.

  rebuild_freshness   replay the ledger into a NonceRegistry (replay protection survives restarts)
  check_anchors       recompute every Merkle root from the anchored entries
  find_disputes       transferability violations: for the same signature (key_id, nonce), a
                      verifier ACCEPTED while another verifier that was at least as lenient
                      REJECTED. Either the signer equivocated (repudiation attempt) or a verifier
                      lied; the commit-reveal data tells which. "Strict direct verifier rejects,
                      lenient forwarded verifier accepts" is the INTENDED effect of the
                      tau < tau_transfer gap, so it is not a dispute.
  check_symmetrisation  every revealed share matches its on-chain commitment
"""

from __future__ import annotations

from collections import defaultdict

from ..detect.registry import NonceRegistry
from .commit_reveal import verify_reveal
from .hashchain import HashChainLedger
from .merkle import merkle_root


def rebuild_freshness(ledger: HashChainLedger) -> NonceRegistry:
    reg = NonceRegistry()
    for e in ledger.by_kind("verdict"):
        p = e.payload
        if p["decision"] == "ACCEPT":
            reg.commit(signer_id=p["signer_id"], verifier_id=p["verifier_id"], nonce_hex=p["nonce"],
                       counter=p["counter"], key_id=p["key_id"])
    return reg


def check_anchors(ledger: HashChainLedger) -> list[str]:
    problems = []
    for a in ledger.by_kind("merkle_anchor"):
        leaves = [bytes.fromhex(ledger.entries[i].entry_hash) for i in a.payload["members"]]
        if merkle_root(leaves) != a.payload["root"]:
            problems.append(f"anchor {a.index}: Merkle root mismatch")
    return problems


def find_disputes(ledger: HashChainLedger) -> list[dict]:
    # leniency: 0 = direct recipient (tau), 1 = forwarded (tau_transfer)
    groups: dict[tuple[str, str], dict[str, tuple[str, int]]] = defaultdict(dict)
    for e in ledger.by_kind("verdict"):
        p = e.payload
        groups[(p["key_id"], p["nonce"])].setdefault(
            p["verifier_id"], (p["decision"], int(bool(p.get("transferred")))))
    disputes = []
    for (key_id, nonce), verdicts in groups.items():
        accepts = [lv for d, lv in verdicts.values() if d == "ACCEPT"]
        rejects = [lv for d, lv in verdicts.values() if d == "REJECT"]
        if accepts and rejects and max(rejects) >= min(accepts):
            disputes.append({
                "key_id": key_id, "nonce": nonce,
                "verdicts": {v: {"decision": d, "transferred": bool(lv)}
                             for v, (d, lv) in verdicts.items()},
                "finding": "transferability violation - signer equivocation "
                           "(repudiation attempt) or a dishonest verifier"})
    return disputes


def check_symmetrisation(ledger: HashChainLedger) -> dict:
    commits = {e.payload["key_id"]: e.payload["commitments"] for e in ledger.by_kind("sym_commit")}
    problems, revealed = [], set()
    for e in ledger.by_kind("sym_reveal"):
        key_id = e.payload["key_id"]
        revealed.add(key_id)
        for party, r in e.payload["reveals"].items():
            c = commits.get(key_id, {}).get(party)
            if c is None or not verify_reveal(key_id, party, bytes.fromhex(r["share"]),
                                              bytes.fromhex(r["salt"]), c):
                problems.append(f"key {key_id}: reveal by {party} does not match commitment")
    return {"committed": len(commits), "revealed": len(revealed),
            "unrevealed": sorted(set(commits) - revealed), "problems": problems}


def audit(ledger: HashChainLedger) -> dict:
    ok, chain_detail = ledger.verify_chain()
    anchors = check_anchors(ledger)
    sym = check_symmetrisation(ledger)
    disputes = find_disputes(ledger)
    return {"chain_ok": ok, "chain_detail": chain_detail, "anchor_problems": anchors,
            "symmetrisation": sym, "disputes": disputes,
            "ok": ok and not anchors and not sym["problems"] and not disputes}
