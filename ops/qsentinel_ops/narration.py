"""LLM forensic narration: plain-language incident summaries from the structured certificate.

The certificate/transcript is the ground truth; the narrative is presentation only.
TODO(phase-4): implement with the Anthropic SDK (pip install -e ops[llm]), model id from env var,
always prefix output with ADVISORY_LABEL.
"""

from . import ADVISORY_LABEL


def narrate(certificate: dict) -> str:
    alerts = certificate.get("alerts") or ["no alerts"]
    return (f"[{ADVISORY_LABEL}] Verdict {certificate.get('decision')}: " + "; ".join(alerts))
