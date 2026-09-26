"""Statistical calibration and sequential detection helpers (D5)."""

from .hoeffding import hoeffding_bound, threshold_from_target_alpha
from .chernoff import kl_divergence_bernoulli, chernoff_bound
from .chi_square import chi_square_uniformity
from .cusum import cusum_statistic, cusum_detect
from .sprt import sprt
from .calibration import (
    CalibratedThresholds,
    FARValidationReport,
    calibrate,
    exact_binomial_tail,
    validate_false_alarm_rate,
    wilson_interval,
)

__all__ = [
    "hoeffding_bound",
    "threshold_from_target_alpha",
    "kl_divergence_bernoulli",
    "chernoff_bound",
    "chi_square_uniformity",
    "cusum_statistic",
    "cusum_detect",
    "sprt",
    "CalibratedThresholds",
    "FARValidationReport",
    "calibrate",
    "exact_binomial_tail",
    "validate_false_alarm_rate",
    "wilson_interval",
]
