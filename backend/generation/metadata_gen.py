"""
Metadata generation — SEO-optimized title, description, trend tags,
and Myntra SKU fields generated from confirmed attributes via Gemini.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

import google.generativeai as genai

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import GEMINI_API_KEY, METADATA_GENERATION_PROMPT

logger = logging.getLogger(__name__)

genai.configure(api_key=GEMINI_API_KEY)


def generate_metadata(
    confirmed_attributes: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate listing metadata from confirmed attributes.

    Parameters
    ----------
    confirmed_attributes : dict
        Seller-confirmed product attributes (visual + physical).

    Returns
    -------
    dict
        Keys: title, description, trend_tags, occasion_tags,
        search_keywords, sku_fields.
    """
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not set. Returning basic metadata.")
        return _basic_metadata(confirmed_attributes)

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.6,  # Slightly creative for descriptions
            },
        )

        attrs_json = json.dumps(confirmed_attributes, indent=2)
        prompt = METADATA_GENERATION_PROMPT.format(attributes_json=attrs_json)

        response = model.generate_content([prompt])
        raw = response.text.strip()
        metadata: Dict[str, Any] = json.loads(raw)

        # Validate required keys
        required = ["title", "description", "trend_tags", "sku_fields"]
        for key in required:
            if key not in metadata:
                metadata[key] = _basic_metadata(confirmed_attributes).get(key, "")

        return metadata

    except json.JSONDecodeError as exc:
        logger.error("Gemini returned non-JSON for metadata: %s", exc)
        return _basic_metadata(confirmed_attributes)
    except Exception:
        logger.exception("Metadata generation failed.")
        return _basic_metadata(confirmed_attributes)


def _basic_metadata(attrs: Dict[str, Any]) -> Dict[str, Any]:
    """Construct basic metadata directly from attributes (no AI)."""
    garment = attrs.get("garment_type", "Garment")
    color = attrs.get("primary_color", "")
    pattern = attrs.get("pattern", "")
    neck = attrs.get("neck_type", "")
    sleeve = attrs.get("sleeve_type", "")
    fabric = attrs.get("fabric_appearance", attrs.get("fabric", ""))

    title_parts = [p for p in [color, pattern, fabric, garment, neck, sleeve] if p]
    title = " ".join(title_parts).title()

    return {
        "title": title[:80],
        "description": f"{title}. Made from {fabric}." if fabric else title,
        "trend_tags": [],
        "occasion_tags": [],
        "search_keywords": [p.lower() for p in title_parts if p],
        "sku_fields": {
            "fabric": fabric,
            "pattern": pattern,
            "sleeve_length": sleeve,
            "neck_type": neck,
            "fit_type": attrs.get("fit_type", ""),
            "occasion": "",
            "wash_care": attrs.get("wash_care", ""),
            "garment_length": attrs.get("overall_length", ""),
        },
    }
