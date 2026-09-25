"""IBM Quantum hardware backend - Phase 4 (D13 Hardware Validation Study).

Plan:
  * pip install -e .[ibm]; save token once with QiskitRuntimeService.save_account(...)
  * Reuse the circuit builder from qiskit_backend (deferred-measurement corrections, so no
    dynamic circuits needed), transpile for the target Heron-class device, run with SamplerV2.
  * Open plan = ~10 QPU minutes / month: batch many rounds per job, cache raw job results
    under notebooks/hardware_runs/, never re-run what is already cached.
  * Use RAW counts in the trust path. Readout-error mitigation is for characterisation only.

TODO(quantum-lead): implement.
"""

from __future__ import annotations

from .backend import ChannelModel, RoundResult


class IBMHardwareBackend:
    name = "ibm"

    def teleport_and_measure(self, prep_bases, prep_values, meas_bases,
                             channel: ChannelModel, seed: int) -> RoundResult:
        raise NotImplementedError("Phase 4: IBM hardware backend not implemented yet")

    def bell_correlators(self, n_pairs: int, channel: ChannelModel, seed: int) -> dict[str, float]:
        raise NotImplementedError("Phase 4: IBM hardware backend not implemented yet")
