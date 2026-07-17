"""
Verdict engine — combines all verification signals into a final PASS / FAIL / WARNING.

Aggregates outputs from:
  • Three-way attribute comparison (hard + soft mismatches)
  • Fabric verification (identifiability + consistency)
  • Embedding similarity score (MobileNetV2 cosine)
  • Mismatch localizations

Produces a single structured verdict with recommendations.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import (
    EMBEDDING_SIMILARITY_PASS,
    EMBEDDING_SIMILARITY_FAIL,
)

logger = logging.getLogger(__name__)


def generate_verdict(
    comparison_results: List[Dict[str, Any]],
    fabric_result: Dict[str, Any],
    embedding_similarity: float,
    localizations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Combine all verification signals into a structured verdict.

    Parameters
    ----------
    comparison_results : list[dict]
        Output of :func:`three_way_compare.compare_attributes`.
    fabric_result : dict
        Output of :func:`fabric.verify_fabric`.
    embedding_similarity : float
        Cosine similarity from :func:`embeddings.compute_similarity` (0–1).
    localizations : list[dict]
        Output of :func:`localization.localize_mismatches`.

    Returns
    -------
    dict
        Complete verdict with keys: status, reason, overall_similarity,
        structural_mismatches, soft_warnings, fabric, localizations,
        recommendations, attribute_results.
    """
    # ── Categorize mismatches ────────────────────────────────────────────
    high_mismatches = [
        r for r in comparison_results
        if r["status"] == "MISMATCH" and r["severity"] == "HIGH"
    ]
    medium_mismatches = [
        r for r in comparison_results
        if r["status"] == "MISMATCH" and r["severity"] == "MEDIUM"
    ]

    # ── Determine verdict ────────────────────────────────────────────────
    fail_reasons: List[str] = []
    warning_reasons: List[str] = []

    # FAIL conditions
    if high_mismatches:
        attrs = [m["attr"].replace("_", " ") for m in high_mismatches]
        fail_reasons.append(
            f"{len(high_mismatches)} structural mismatch(es): {', '.join(attrs)}"
        )

    if not fabric_result.get("fabric_identifiable", True):
        fail_reasons.append("Fabric texture not identifiable in catalog image")

    if embedding_similarity < EMBEDDING_SIMILARITY_FAIL:
        fail_reasons.append(
            f"Visual similarity too low ({embedding_similarity:.0%})"
        )

    # WARNING conditions
    if medium_mismatches:
        attrs = [m["attr"].replace("_", " ") for m in medium_mismatches]
        warning_reasons.append(
            f"{len(medium_mismatches)} soft attribute warning(s): {', '.join(attrs)}"
        )

    if not fabric_result.get("fabric_matches_anchor", True):
        warning_reasons.append("Fabric appearance differs between anchor and catalog")

    if (
        embedding_similarity >= EMBEDDING_SIMILARITY_FAIL
        and embedding_similarity < EMBEDDING_SIMILARITY_PASS
    ):
        warning_reasons.append(
            f"Borderline visual similarity ({embedding_similarity:.0%})"
        )

    # Final status
    if fail_reasons:
        status = "FAIL"
        reason = "; ".join(fail_reasons)
    elif warning_reasons:
        status = "WARNING"
        reason = "; ".join(warning_reasons)
    else:
        status = "PASS"
        reason = "All checks passed — listing is verified"

    # ── Build recommendations ────────────────────────────────────────────
    recommendations = _build_recommendations(
        high_mismatches,
        medium_mismatches,
        fabric_result,
        embedding_similarity,
        localizations,
    )

    return {
        "status": status,
        "reason": reason,
        "overall_similarity": round(embedding_similarity, 4),
        "structural_mismatches": [
            {
                "attribute": m["attr"],
                "anchor_value": m["anchor_value"],
                "catalog_value": m["catalog_value"],
                "declared_value": m["declared_value"],
                "detail": m["detail"],
            }
            for m in high_mismatches
        ],
        "soft_warnings": [
            {
                "attribute": m["attr"],
                "anchor_value": m["anchor_value"],
                "catalog_value": m["catalog_value"],
                "declared_value": m["declared_value"],
                "detail": m["detail"],
            }
            for m in medium_mismatches
        ],
        "fabric": {
            "identifiable": fabric_result.get("fabric_identifiable", True),
            "matches_anchor": fabric_result.get("fabric_matches_anchor", True),
            "matches_declared": fabric_result.get("fabric_matches_declared", True),
            "confidence": fabric_result.get("confidence", 0.0),
            "issue": fabric_result.get("issue"),
            "recommendation": fabric_result.get("recommendation"),
        },
        "localizations": localizations,
        "recommendations": recommendations,
        "attribute_results": comparison_results,
    }


def _build_recommendations(
    high_mismatches: List[Dict],
    medium_mismatches: List[Dict],
    fabric_result: Dict,
    similarity: float,
    localizations: List[Dict],
) -> List[Dict[str, Any]]:
    """Build a priority-ordered list of actionable recommendations."""
    recs: List[Dict[str, Any]] = []

    # HIGH priority: structural mismatches
    for m in high_mismatches:
        attr_name = m["attr"].replace("_", " ")
        loc = next(
            (l for l in localizations if l["attribute"] == m["attr"]),
            None,
        )
        fix = loc["seller_fix"] if loc else (
            f"Update the catalog image to match the real product's {attr_name}, "
            f"or correct the declared metadata."
        )
        recs.append({
            "priority": "HIGH",
            "attribute": m["attr"],
            "title": f"{attr_name.title()} mismatch",
            "detail": (
                f"Catalog shows '{m['catalog_value']}' but the real product "
                f"has '{m['anchor_value']}'. "
                f"Declared value: '{m['declared_value']}'."
            ),
            "fix": fix,
        })

    # HIGH: fabric not identifiable
    if not fabric_result.get("fabric_identifiable", True):
        recs.append({
            "priority": "HIGH",
            "attribute": "fabric",
            "title": "Fabric not identifiable",
            "detail": (
                "The fabric texture in the catalog image is too smooth or "
                "AI-rendered for a shopper to identify the material."
            ),
            "fix": (
                "Add a real fabric closeup (macro photo) as the 2nd image "
                "in your product carousel so shoppers can verify the material."
            ),
        })

    # MEDIUM: soft attribute warnings
    for m in medium_mismatches:
        attr_name = m["attr"].replace("_", " ")
        recs.append({
            "priority": "MEDIUM",
            "attribute": m["attr"],
            "title": f"{attr_name.title()} difference",
            "detail": (
                f"Catalog: '{m['catalog_value']}' vs "
                f"Anchor: '{m['anchor_value']}'. "
                "This may be a lighting/angle artifact."
            ),
            "fix": f"Review the {attr_name} in your listing and confirm it's accurate.",
        })

    # MEDIUM: low similarity
    if similarity < EMBEDDING_SIMILARITY_PASS:
        recs.append({
            "priority": "MEDIUM",
            "attribute": "visual_similarity",
            "title": "Borderline visual similarity",
            "detail": (
                f"Visual similarity is {similarity:.0%}. "
                "Regenerating the catalog image typically improves this."
            ),
            "fix": "Consider regenerating the catalog image for better accuracy.",
        })

    return recs
