from enum import IntEnum


class Basis(IntEnum):
    """Pauli eigenbases. Value bit 0 -> +1 eigenstate, 1 -> -1 eigenstate."""

    Z = 0  # |0>, |1>
    X = 1  # |+>, |->
    Y = 2  # |+i>, |-i>


BASIS_NAMES = {Basis.Z: "Z", Basis.X: "X", Basis.Y: "Y"}
