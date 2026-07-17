"""
Three-way attribute comparison engine.

Compares attributes from three sources — the anchor image, the catalog
image, and seller-declared metadata — to surface mismatches.  Uses a
synonym map for fuzzy matching so that semantically-equivalent values
(e.g. "crew neck" vs "round neck") are not flagged as mismatches.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import HARD_ATTRIBUTES, SOFT_ATTRIBUTES, SYNONYM_MAP

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalise(value: Any) -> Optional[str]:
    """Lowercase-strip a value; return *None* for missing/null."""
    if value is None:
        return None
    if isinstance(value, str):
        v = value.strip().lower()
        return v if v else None
    return str(value).strip().lower()


def _canonical(attribute: str, value: Optional[str]) -> Optional[str]:
    """Map *value* to its canonical synonym group for *attribute*.

    If the attribute appears in ``SYNONYM_MAP`` and the value matches any
    synonym list, the canonical group key is returned.  Otherwise the
    original normalised value is returned unchanged.
    """
    if value is None:
        return None
    attr_syns = SYNONYM_MAP.get(attribute)
    if attr_syns is None:
        return value
    for canonical_key, synonyms in attr_syns.items():
        if value in (s.lower() for s in synonyms):
            return canonical_key
    return value


def fuzzy_match(attribute: str, val_a: Any, val_b: Any) -> bool:
    """Return *True* if two attribute values should be considered equal.

    Handles:
    * ``None`` / missing values — treated as *unknown*, so a comparison
      involving ``None`` is always ``True`` (we cannot say it mismatches).
    * Synonym mapping via ``SYNONYM_MAP`` from config.
    * List-type attributes (``structural_features``, ``secondary_colors``)
      — checked as subset / superset overlap.
    """
    # --- If either side is unknown, we can't confirm a mismatch. ---
    if val_a is None or val_b is None:
        return True

    # --- List comparison (structural_features, secondary_colors) ---
    if isinstance(val_a, list) or isinstance(val_b, list):
        set_a = {_normalise(v) for v in (val_a if isinstance(val_a, list) else [val_a])} - {None}
        set_b = {_normalise(v) for v in (val_b if isinstance(val_b, list) else [val_b])} - {None}
        if not set_a or not set_b:
            return True  # nothing to compare
        # Canonicalise each element.
        canon_a = {_canonical(attribute, v) for v in set_a}
        canon_b = {_canonical(attribute, v) for v in set_b}
        # Match if one is a subset of the other (allows partial detection).
        return bool(canon_a & canon_b)

    # --- Scalar comparison ---
    norm_a = _normalise(val_a)
    norm_b = _normalise(val_b)
    if norm_a is None or norm_b is None:
        return True
    if norm_a == norm_b:
        return True
    return _canonical(attribute, norm_a) == _canonical(attribute, norm_b)


# ── Core Comparator ──────────────────────────────────────────────────────────

def _pair_detail(label_a: str, label_b: str, val_a: Any, val_b: Any) -> str:
    """Human-readable one-liner describing a pairwise mismatch."""
    return f"{label_a}='{val_a}' vs {label_b}='{val_b}'"


def compare_attributes(
    anchor_attrs: Dict[str, Any],
    catalog_attrs: Dict[str, Any],
    declared_attrs: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Run the three-way comparison across all tracked attributes.

    Parameters
    ----------
    anchor_attrs : dict
        Attributes extracted from the anchor (real product) image.
    catalog_attrs : dict
        Attributes extracted from the catalog (listing) image.
    declared_attrs : dict
        Attributes declared by the seller in the product metadata.

    Returns
    -------
    list[dict]
        One entry per attribute.  Each dict contains:

        * ``attr`` – attribute name
        * ``status`` – ``"MATCH"`` or ``"MISMATCH"``
        * ``severity`` – ``"HIGH"`` | ``"MEDIUM"`` | ``"NONE"``
        * ``anchor_value`` – value from anchor
        * ``catalog_value`` – value from catalog
        * ``declared_value`` – value from declared metadata
        * ``detail`` – human-readable explanation
    """
    # Normalise incoming dicts so None keys don't crash.
    anchor_attrs = anchor_attrs or {}
    catalog_attrs = catalog_attrs or {}
    declared_attrs = declared_attrs or {}

    results: List[Dict[str, Any]] = []

    all_attributes = HARD_ATTRIBUTES + SOFT_ATTRIBUTES

    for attr in all_attributes:
        anchor_val = anchor_attrs.get(attr)
        catalog_val = catalog_attrs.get(attr)
        declared_val = declared_attrs.get(attr)

        # If *all three* are None we can't say anything useful.
        if anchor_val is None and catalog_val is None and declared_val is None:
            continue

        # Pairwise checks.
        ac_match = fuzzy_match(attr, anchor_val, catalog_val)
        ad_match = fuzzy_match(attr, anchor_val, declared_val)
        cd_match = fuzzy_match(attr, catalog_val, declared_val)

        all_match = ac_match and ad_match and cd_match

        severity = "NONE"
        if not all_match:
            severity = "HIGH" if attr in HARD_ATTRIBUTES else "MEDIUM"

        detail_parts: List[str] = []
        if not ac_match:
            detail_parts.append(_pair_detail("anchor", "catalog", anchor_val, catalog_val))
        if not ad_match:
            detail_parts.append(_pair_detail("anchor", "declared", anchor_val, declared_val))
        if not cd_match:
            detail_parts.append(_pair_detail("catalog", "declared", catalog_val, declared_val))

        results.append(
            {
                "attr": attr,
                "status": "MATCH" if all_match else "MISMATCH",
                "severity": severity,
                "anchor_value": anchor_val,
                "catalog_value": catalog_val,
                "declared_value": declared_val,
                "detail": "; ".join(detail_parts) if detail_parts else "All sources agree.",
            }
        )

    return results
