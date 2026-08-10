#!/usr/bin/env python3
"""Calibration harness for the verification-network channel thresholds.

Turns "reasoned estimates" into "calibrated on N labelled pairs". Feed it a
JSON file of labelled pairs and it reports, per channel, how well the current
thresholds separate the classes and where the optimal cut sits.

Labelled-pairs file format (build it in an afternoon from your own photos):

  [
    {"anchor": ["front.jpg","back.jpg","closeup.jpg"],
     "catalog": ["cat_front.jpg","cat_back.jpg","cat_closeup.jpg"],
     "hint": "kurti",
     "label": "same"},         // same physical garment, different shots
    {"anchor": [...], "catalog": [...], "hint": "top",
     "label": "different"}     // HARD negatives: same category, different product
  ]

Include hard negatives — same-category-different-product is the fraud case,
and thresholds tuned only on easy negatives will overclaim.

Usage:  python scripts/calibrate.py pairs.json
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services"))

from verification_math import compare_color_sets, compare_texture  # noqa: E402


def best_cut(same_vals, diff_vals):
    """Threshold minimising total classification error (same below, diff above)."""
    candidates = sorted(set(same_vals + diff_vals))
    best = (None, len(same_vals) + len(diff_vals))
    for c in candidates:
        errors = sum(1 for v in same_vals if v > c) + sum(1 for v in diff_vals if v <= c)
        if errors < best[1]:
            best = (c, errors)
    return best


def main(path):
    pairs = json.load(open(path))
    color_same, color_diff = [], []
    period_same = []

    for i, pair in enumerate(pairs):
        label = pair["label"]
        c = compare_color_sets(pair["anchor"], pair["catalog"], pair.get("hint"))
        if c.get("success"):
            (color_same if label == "same" else color_diff).append(c["delta_e_median"])
        t = compare_texture(pair["anchor"][0], pair["catalog"][0])
        if t.get("success") and t.get("applicable") and "period_ratio" in t and label == "same":
            period_same.append(abs(1 - t["period_ratio"]))
        print(f"[{i + 1}/{len(pairs)}] {label}: dE={c.get('delta_e_median')} "
              f"period_dev={abs(1 - t['period_ratio']) if t.get('success') and 'period_ratio' in t else 'n/a'}")

    print("\n── Colour channel (CIEDE2000 kL=2, median across views) ──")
    print(f"  same-garment:      n={len(color_same)}  values={sorted(color_same)}")
    print(f"  different-garment: n={len(color_diff)}  values={sorted(color_diff)}")
    if color_same and color_diff:
        cut, errors = best_cut(color_same, color_diff)
        print(f"  optimal cut: dE ≈ {cut}  (misclassifies {errors}/{len(color_same) + len(color_diff)})")
        print("  → update COLOR_BANDS in services/verification_channels.js accordingly.")

    print("\n── Print-geometry channel (period deviation |1 - ratio|) ──")
    if period_same:
        print(f"  same-garment deviations: {sorted(period_same)}")
        print(f"  suggested 'preserved' band: max deviation ≈ {max(period_same) * 1.3:.2f}")
        print("  → update PERIOD_BANDS in services/verification_channels.js accordingly.")
    else:
        print("  no periodic same-garment pairs in this set — add striped/printed pairs.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
