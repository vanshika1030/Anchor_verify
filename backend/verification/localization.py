"""
Mismatch localization via Gemini.

Given a catalog image and a list of detected mismatches, asks Gemini to
identify WHERE on the catalog image each mismatch is visually apparent
and returns bounding-box coordinates (as percentages) plus human-readable
explanations.
"""

from __future__ import annotations

import io
import json
import logging
from typing import Any, Dict, List

import google.generativeai as genai
from PIL import Image

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import GEMINI_API_KEY, MISMATCH_LOCALIZATION_PROMPT

logger = logging.getLogger(__name__)

genai.configure(api_key=GEMINI_API_KEY)


def localize_mismatches(
    catalog_image: Image.Image,
    mismatches: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Identify mismatch regions on the catalog image.

    Parameters
    ----------
    catalog_image : PIL.Image.Image
        The catalog/listing image to annotate.
    mismatches : list[dict]
        Mismatch entries from :func:`three_way_compare.compare_attributes`
        where ``status == "MISMATCH"``.

    Returns
    -------
    list[dict]
        Each entry: ``{attribute, region_description, bbox_pct,
        shopper_explanation, seller_fix}``.
        ``bbox_pct`` is ``[x_min, y_min, x_max, y_max]`` as 0-100 percentages.
    """
    if not mismatches:
        return []

    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not set. Skipping localization.")
        return _fallback_localizations(mismatches)

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.2,
            },
        )

        # Build mismatch description text
        descriptions = []
        for m in mismatches:
            desc = (
                f"- {m['attr']}: anchor shows '{m.get('anchor_value', '?')}' "
                f"but catalog shows '{m.get('catalog_value', '?')}'"
            )
            descriptions.append(desc)

        mismatch_text = "\n".join(descriptions)
        prompt = MISMATCH_LOCALIZATION_PROMPT.format(
            mismatch_descriptions=mismatch_text
        )

        # Send catalog image + prompt
        buf = io.BytesIO()
        catalog_image.convert("RGB").save(buf, format="PNG")
        image_part = {
            "inline_data": {
                "mime_type": "image/png",
                "data": buf.getvalue(),
            }
        }

        response = model.generate_content([prompt, image_part])
        raw = response.text.strip()
        localizations: List[Dict[str, Any]] = json.loads(raw)

        # Validate structure
        valid = []
        for loc in localizations:
            valid.append({
                "attribute": loc.get("attribute", "unknown"),
                "region_description": loc.get("region_description", ""),
                "bbox_pct": loc.get("bbox_pct", [0, 0, 100, 100]),
                "shopper_explanation": loc.get("shopper_explanation", ""),
                "seller_fix": loc.get("seller_fix", ""),
            })

        return valid

    except json.JSONDecodeError as exc:
        logger.error("Gemini returned non-JSON for localization: %s", exc)
        return _fallback_localizations(mismatches)
    except Exception:
        logger.exception("Localization failed.")
        return _fallback_localizations(mismatches)


def _fallback_localizations(
    mismatches: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Create generic fallback localizations when Gemini call fails."""
    results = []
    for m in mismatches:
        attr = m.get("attr", "unknown")
        # Map common attributes to approximate regions
        region_map = {
            "sleeve_type": ([5, 15, 50, 65], "sleeve area"),
            "neck_type": ([25, 0, 75, 20], "neckline area"),
            "pattern": ([10, 10, 90, 90], "overall garment surface"),
            "silhouette": ([10, 20, 90, 95], "garment outline"),
            "overall_length": ([15, 60, 85, 100], "hem/lower section"),
            "fit_type": ([15, 15, 85, 85], "overall fit"),
            "primary_color": ([10, 10, 90, 90], "overall garment"),
        }
        bbox, region = region_map.get(attr, ([0, 0, 100, 100], "garment area"))

        results.append({
            "attribute": attr,
            "region_description": region,
            "bbox_pct": bbox,
            "shopper_explanation": (
                f"The {attr.replace('_', ' ')} in this listing doesn't "
                f"match the real product."
            ),
            "seller_fix": (
                f"Update the catalog image or correct the {attr.replace('_', ' ')} "
                f"to match the actual product."
            ),
        })
    return results
