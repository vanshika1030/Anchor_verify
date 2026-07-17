"""
Size chart proportional consistency check.

Validates that measurement differences between consecutive sizes
(S→M→L→XL) are proportionally consistent — flags irregular scaling
where one size jump is drastically larger than another.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# Standard size ordering for comparison
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL"]


def _sort_sizes(size_chart: Dict[str, Dict[str, float]]) -> List[str]:
    """Sort size keys by standard size ordering."""
    known = [s for s in SIZE_ORDER if s in size_chart]
    unknown = [s for s in size_chart if s not in SIZE_ORDER]
    return known + sorted(unknown)


def check_size_chart(
    size_chart: Dict[str, Dict[str, float]],
) -> Dict[str, Any]:
    """Check if a size chart has proportionally consistent measurements.

    Parameters
    ----------
    size_chart : dict
        Mapping of size labels to measurement dicts.
        Example: ``{"S": {"chest": 36, "length": 26}, "M": {"chest": 38, "length": 27}}``

    Returns
    -------
    dict
        ``{status: "PASS" | "WARNING", details: [...]}``.
    """
    if not size_chart or len(size_chart) < 2:
        return {"status": "PASS", "details": ["Insufficient sizes to compare"]}

    sizes = _sort_sizes(size_chart)
    if len(sizes) < 2:
        return {"status": "PASS", "details": ["Insufficient sizes to compare"]}

    # Collect all measurement keys present across sizes
    all_measurements = set()
    for data in size_chart.values():
        if isinstance(data, dict):
            all_measurements.update(data.keys())

    issues: List[str] = []

    for measurement in all_measurements:
        diffs: List[float] = []
        pairs: List[str] = []

        for i in range(len(sizes) - 1):
            small = size_chart.get(sizes[i], {})
            large = size_chart.get(sizes[i + 1], {})

            val_small = small.get(measurement)
            val_large = large.get(measurement)

            if val_small is None or val_large is None:
                continue

            try:
                diff = float(val_large) - float(val_small)
                diffs.append(diff)
                pairs.append(f"{sizes[i]}→{sizes[i+1]}")
            except (ValueError, TypeError):
                continue

        if len(diffs) < 2:
            continue

        # Check for inconsistent scaling
        min_diff = min(abs(d) for d in diffs) if diffs else 0
        max_diff = max(abs(d) for d in diffs) if diffs else 0

        # Flag if any diff is 2x+ another diff (e.g., S→M is +2" but M→L is +6")
        if min_diff > 0 and max_diff > 2 * min_diff:
            detail_pairs = [
                f"{p}: {d:+.1f}" for p, d in zip(pairs, diffs)
            ]
            issues.append(
                f"{measurement}: irregular scaling — "
                f"{', '.join(detail_pairs)}"
            )

        # Flag if measurement goes DOWN when size goes UP
        for i, diff in enumerate(diffs):
            if diff < -0.5:  # Allow tiny rounding
                issues.append(
                    f"{measurement}: decreases from {pairs[i]} "
                    f"({diff:+.1f}), which is unexpected"
                )

    if issues:
        return {
            "status": "WARNING",
            "details": issues,
        }

    return {
        "status": "PASS",
        "details": ["Size chart scaling is proportionally consistent"],
    }
