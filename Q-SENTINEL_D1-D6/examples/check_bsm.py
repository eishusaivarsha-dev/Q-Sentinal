"""Optional Qiskit/Aer BSM demonstration."""

from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from qsentinel.quantum.backends import QiskitAerBackend
from qsentinel.statistics.chi_square import chi_square_uniformity


def main() -> None:
    backend = QiskitAerBackend()
    counts = backend.bsm_counts(4096)
    print(counts)
    print(chi_square_uniformity(counts))


if __name__ == "__main__":
    main()
