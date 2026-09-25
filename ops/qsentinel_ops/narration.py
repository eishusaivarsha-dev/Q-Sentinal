"""Forensic narration: plain-language incident summaries.

The certificate / telemetry is the ground truth; the narrative is presentation only and always
carries ADVISORY_LABEL. Today this is a deterministic template, so it works offline and is
reproducible.
TODO(phase-4): optional LLM phrasing with the Anthropic SDK (pip install -e ops[llm]), model id
from an env var, same label, same inputs; keep the template as the fallback.
"""

from . import ADVISORY_LABEL

DETECTOR_WORDS = {
    "D1": "non-deterministic outcomes", "D2": "forgery-level mismatches",
    "D3": "entanglement degradation", "D4": "channel eavesdropping signs",
    "D5": "replayed or reused credentials", "D6": "identity or honeypot violations",
}


def narrate(certificate: dict) -> str:
    alerts = certificate.get("alerts") or ["no alerts"]
    return f"[{ADVISORY_LABEL}] Verdict {certificate.get('decision')}: " + "; ".join(alerts)


def narrate_incident(incident: dict) -> str:
    what = ", ".join(DETECTOR_WORDS.get(d, d) for d in incident["detectors"]) or "alerts"
    links = ", ".join(incident["links"])
    text = (f"[{ADVISORY_LABEL}] {incident['size']} verification(s) on {links} showed {what}"
            f" ({incident['critical']} rejected; mean error rate {incident['mean_qber']:.1%}).")
    if incident["fingerprints"]:
        text += " Channel fingerprint: " + "; ".join(incident["fingerprints"]) + "."
    if "D6" in incident["detectors"]:
        text += " Check the key store and the verifier list first."
    elif {"D3", "D4"} & set(incident["detectors"]):
        text += " Inspect the quantum link for an eavesdropper; consider re-routing traffic."
    elif "D2" in incident["detectors"]:
        text += " The signatures themselves were invalid; the link looks clean."
    return text
