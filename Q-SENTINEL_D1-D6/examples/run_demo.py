"""Run an end-to-end D1-D6 reference demonstration."""

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from qsentinel.attacks.base import AttackScenario
from qsentinel.attacks.runner import run_campaign
from qsentinel.qds.keygen import generate_keypair, distribute_public_key
from qsentinel.qds.signer import sign
from qsentinel.qds.verifier import verify
from qsentinel.quantum.backends import IdealBackend


def main() -> None:
    rounds = 128
    private, verifier_key = generate_keypair(
        rounds=rounds,
        seed=2026,
        verifier_id="verifier-01",
    )
    public = distribute_public_key(private, backend=IdealBackend())
    signature = sign(
        "Q-SENTINEL: hello from the quantum trust kernel",
        private,
        public,
        nonce="demo-nonce-0001",
    )
    honest = verify(
        "Q-SENTINEL: hello from the quantum trust kernel",
        signature,
        public,
        verifier_key,
    )
    print("HONEST VERIFICATION")
    print(f"accepted={honest.accepted} mismatches={honest.mismatches}/{honest.rounds}")

    base = AttackScenario(
        name="honest-baseline",
        description="Honest reference for D6 attack injection.",
        public_key=public,
        signature=signature,
        verifier_key=verifier_key,
        chsh_value=2.828,
        bell_fidelity=0.99,
        bsm_counts={"00": 250, "01": 250, "10": 250, "11": 250},
    )

    results = run_campaign(base, seed=2026, strength=1.0)
    print("\nATTACK CAMPAIGN")
    for item in results:
        print(
            f"{item['attack']:<28} -> "
            f"mapped={item['expected_detector']} detected={item['mapped_detector_detected']} "
            f"overall={item['overall_alert']}"
        )

    out = Path(__file__).resolve().parents[1] / "campaign_report.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nSaved report: {out}")


if __name__ == "__main__":
    main()
