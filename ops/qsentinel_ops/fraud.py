"""Fraud review queue (advisory): which verifications look like fraud, how sure, and why.

The detectors already decided every verdict. This module answers the analyst's next question -
"is someone committing fraud here, and what should I do about it?" - by combining:

  * the fixed attribution of the detector output (which attack class the alerts point to),
  * ledger evidence (transferability disputes = attempted repudiation),
  * the Isolation Forest's "least typical" score (anomaly.py),
  * the signer's recent failure rate, and the link's forecast risk.

Each case gets a 0-100 risk score, a category, plain-language reasons (every one traceable to a
number the kernel produced) and a RECOMMENDED disposition. The analyst makes the call in the
console; the decision is written to the ledger by the kernel (POST /reviews/{index}), together
with this recommendation, so the audit trail shows whether the human agreed with the AI.
Nothing here can change a verdict.
"""

from __future__ import annotations

from collections import defaultdict

import httpx

from . import ADVISORY_LABEL
from .anomaly import rank
from .forecast import forecast_all

DISPOSITIONS = {
    "confirm_fraud": "Confirm fraud: treat as a real attack, contain it and keep the evidence.",
    "escalate": "Escalate: hand to incident response / the key custodian for a second look.",
    "monitor": "Monitor: no action now, but watch this signer or link closely.",
    "dismiss": "Dismiss: consistent with honest traffic or a known red-team run.",
}

# (category, base risk, reason, containment steps) per attribution rule. Order matters: the first
# match is the primary finding; later matches add reasons.
Rule = tuple[str, int, str, list[str]]


def _rules(data: dict, disputed: set[str]) -> list[Rule]:
    fired = {a["detector"]: a for a in data.get("alerts", []) if a.get("alert") and a.get("severity") != "info"}
    out: list[Rule] = []
    if data.get("key_id") in disputed:
        out.append(("Repudiation attempt", 90,
                    "The ledger auditor found verifiers split on this signature: the signer may be equivocating "
                    "so they can deny it later.",
                    ["Freeze the signer's pending transactions", "Open the transferability evidence on the Ledger page"]))
    d6 = fired.get("D6")
    if d6 is not None and (d6.get("extra") or {}).get("honeypot"):
        out.append(("Stolen keystore", 95,
                    "A decoy (honeypot) key was used to sign. Only someone holding a copy of the key store could do that.",
                    ["Revoke every key in the signer's keystore", "Rotate credentials and investigate the key custodian"]))
    elif d6 is not None and "not authorised" in d6.get("detail", ""):
        out.append(("Unauthorised verification", 80,
                    "A party without the verifier role tried to verify: an insider or a stolen verifier identity.",
                    ["Review the verifier registry", "Check access logs for this verifier"]))
    elif d6 is not None:
        out.append(("Impersonation", 85,
                    "The key was presented by someone other than its owner (identity binding failed).",
                    ["Block the presenting identity", "Confirm with the real key owner out of band"]))
    if "D5" in fired and "D2" in fired:
        out.append(("Key-reuse forgery", 85,
                    "A spent one-time key was reused to sign a different message.",
                    ["Reject any pending transaction with this key", "Trace the submitting client"]))
    elif "D5" in fired:
        out.append(("Replay", 75,
                    "An old signature was resent (nonce / counter already used).",
                    ["Check the client for a replay attempt or a stale cache"]))
    if "D2" in fired and "D5" not in fired:
        out.append(("Forgery or message tampering", 80,
                    "Too many measurement mismatches: whoever produced this signature did not hold the key, "
                    "or the message was changed after signing.",
                    ["Do not act on the signed message", "Trace the submitting client; the channel may be clean"]))
    chan = [fired[d] for d in ("D3", "D4") if d in fired]
    if any(a.get("severity") == "critical" for a in chan):
        out.append(("Channel interception", 60,
                    "The quantum link was tapped (entanglement collapsed or the error rate crossed the alarm). "
                    "Signatures over it cannot be trusted until it is re-commissioned.",
                    ["Pause high-value signing on this link", "Re-route through another link and re-commission it"]))
    elif chan or data.get("fingerprint_drift") or data.get("cusum_alarm"):
        out.append(("Stealth probing", 35,
                    f"Low-level eavesdropping signs on the link ({data.get('fingerprint') or 'channel drift'}) "
                    "while the signature itself still verified.",
                    ["Watch this link's forecast", "Consider moving sensitive signing elsewhere"]))
    return out


def _level(risk: int) -> str:
    return "critical" if risk >= 75 else "high" if risk >= 50 else "medium" if risk >= 25 else "low"


def assess(event: dict, disputed: set[str], unusual: dict[int, dict], signer_fail: dict[str, float],
           link_risk: dict[str, str]) -> dict:
    d = event["data"]
    idx = d.get("ledger_index")
    rules = _rules(d, disputed)
    reasons = [r[2] for r in rules]
    steps = [s for r in rules for s in r[3]]
    risk = max((r[1] for r in rules), default=0)
    category = rules[0][0] if rules else "No fraud indicators"
    if len(rules) > 1:
        risk = min(100, risk + 5 * (len(rules) - 1))
    a = unusual.get(idx)
    if a is not None and a["score"] >= 0.6:
        risk = min(100, risk + round(10 * a["score"]))
        reasons.append(f"Unusual compared with other verifications ({', '.join(a['drivers'])}).")
    fail = signer_fail.get(d.get("signer_id", ""), 0.0)
    if fail >= 0.3 and rules:
        risk = min(100, risk + 5)
        reasons.append(f"This signer's recent signatures fail often ({fail:.0%} rejected).")
    if link_risk.get(d.get("link", "")) in ("high", "elevated") and rules:
        reasons.append(f"The link's forecast risk is {link_risk[d['link']]}.")
    if not rules:
        risk = min(risk, 20)
        reasons = reasons or ["Every detector passed and nothing on the ledger points to misuse."]

    level = _level(risk)
    if not rules:
        rec = "dismiss" if risk < 15 else "monitor"
    elif risk >= 85:
        rec = "confirm_fraud"
    elif risk >= 55:
        rec = "escalate"
    else:
        rec = "monitor"
    return {
        "label": ADVISORY_LABEL,
        "ledger_index": idx,
        "ts": event["ts"],
        "decision": d["decision"],
        "link": d.get("link"),
        "signer_id": d.get("signer_id"),
        "verifier_id": d.get("verifier_id"),
        "key_id": d.get("key_id"),
        "risk": int(risk),
        "level": level,
        "category": category,
        "reasons": reasons,
        "detectors": sorted({a["detector"] for a in d.get("alerts", []) if a.get("alert") and a.get("severity") != "info"}),
        "recommendation": rec,
        "recommendation_text": DISPOSITIONS[rec],
        "containment": list(dict.fromkeys(steps)),
        "confidence": "high" if len(rules) >= 1 and risk >= 75 else "medium" if rules else "low",
    }


def _get(api: str, path: str, key: str | None):
    headers = {"X-API-Key": key} if key else {}
    return httpx.get(f"{api}{path}", headers=headers, timeout=10).raise_for_status().json()


def context(api: str, key: str | None = None) -> dict:
    """Everything the assessor reads, from read-only kernel endpoints."""
    events = [e for e in _get(api, "/telemetry", key) if e["kind"] == "verdict"]
    audit = _get(api, "/ledger/audit", key)
    reviews = _get(api, "/reviews", key)
    links = _get(api, "/links?history=60", key)
    fc = forecast_all(links)
    per_signer: dict[str, list[str]] = defaultdict(list)
    for e in events[-200:]:
        per_signer[e["data"].get("signer_id", "")].append(e["data"]["decision"])
    return {
        "events": events,
        "disputed": {x["key_id"] for x in audit.get("disputes", [])},
        "unusual": {a["ledger_index"]: a for a in rank(events, top=20)["anomalies"]},
        "signer_fail": {s: v.count("REJECT") / len(v) for s, v in per_signer.items() if v},
        "link_risk": {f["link"]: f["risk"] for f in fc["links"]},
        "reviews": {r["verdict_index"]: r for r in reviews},     # latest review wins
    }


def _with_review(case: dict, reviews: dict[int, dict]) -> dict:
    r = reviews.get(case["ledger_index"])
    return {**case, "review": None if r is None else {
        k: r.get(k) for k in ("index", "timestamp", "decision", "note", "reviewer", "agreed_with_ai", "entry_hash")}}


def queue(ctx: dict, min_risk: int = 25, limit: int = 30, include_reviewed: bool = True) -> dict:
    cases = [assess(e, ctx["disputed"], ctx["unusual"], ctx["signer_fail"], ctx["link_risk"]) for e in ctx["events"]]
    flagged = [c for c in cases if c["risk"] >= min_risk]
    flagged.sort(key=lambda c: (-c["risk"], -c["ts"]))
    rows = [_with_review(c, ctx["reviews"]) for c in flagged]
    if not include_reviewed:
        rows = [c for c in rows if c["review"] is None]
    decided = [r for r in ctx["reviews"].values() if r.get("advisory")]
    return {
        "label": ADVISORY_LABEL,
        "scanned": len(cases),
        "flagged": len(flagged),
        "open": sum(c["review"] is None for c in (_with_review(c, ctx["reviews"]) for c in flagged)),
        "by_level": {lv: sum(c["level"] == lv for c in flagged) for lv in ("critical", "high", "medium")},
        "agreement": None if not decided else sum(bool(r.get("agreed_with_ai")) for r in decided) / len(decided),
        "cases": rows[:limit],
    }


def case(ctx: dict, ledger_index: int) -> dict | None:
    for e in ctx["events"]:
        if e["data"].get("ledger_index") == ledger_index:
            c = assess(e, ctx["disputed"], ctx["unusual"], ctx["signer_fail"], ctx["link_risk"])
            return _with_review(c, ctx["reviews"])
    return None
