"""
Fabric texture verification via Gemini.

Compares fabric appearance between anchor and catalog images,
checks if fabric type is identifiable to a shopper, and verifies
consistency with the seller-declared fabric composition.
"""

from __future__ import annotations

import io
import json
import logging
from typing import Any, Dict

import google.generativeai as genai
from PIL import Image

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import GEMINI_API_KEY, FABRIC_VERIFICATION_PROMPT

logger = logging.getLogger(__name__)

genai.configure(api_key=GEMINI_API_KEY)


def _image_to_part(image: Image.Image) -> dict:
    """Convert a PIL image to a Gemini inline-data part."""
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="PNG")
    return {
        "inline_data": {
            "mime_type": "image/png",
            "data": buf.getvalue(),
        }
    }


def verify_fabric(
    anchor_cutout: Image.Image,
    catalog_cutout: Image.Image,
    declared_fabric: str = "unknown",
) -> Dict[str, Any]:
    """Verify fabric consistency between anchor, catalog, and declared metadata.

    Parameters
    ----------
    anchor_cutout : PIL.Image.Image
        Garment isolated from the anchor (real product) photo.
    catalog_cutout : PIL.Image.Image
        Garment isolated from the catalog (listing) image.
    declared_fabric : str
        Seller-declared fabric composition (e.g. "100% Cotton").

    Returns
    -------
    dict
        Keys: anchor_fabric_appearance, catalog_fabric_appearance,
        fabric_identifiable, fabric_matches_anchor, fabric_matches_declared,
        confidence, issue, recommendation, action.
    """
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not set. Skipping fabric verification.")
        return _default_result("API key missing")

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.2,
            },
        )

        prompt = FABRIC_VERIFICATION_PROMPT.format(declared_fabric=declared_fabric)

        anchor_part = _image_to_part(anchor_cutout)
        catalog_part = _image_to_part(catalog_cutout)

        response = model.generate_content(
            [prompt, anchor_part, catalog_part],
        )

        raw = response.text.strip()
        result: Dict[str, Any] = json.loads(raw)

        # Add action recommendation
        if not result.get("fabric_identifiable", True):
            result["action"] = "ADD_FABRIC_CLOSEUP"
        elif not result.get("fabric_matches_anchor", True):
            result["action"] = "REGENERATE_CATALOG"
        else:
            result["action"] = "NONE"

        return result

    except json.JSONDecodeError as exc:
        logger.error("Gemini returned non-JSON for fabric check: %s", exc)
        return _default_result("Non-JSON response from Gemini")
    except Exception:
        logger.exception("Fabric verification failed.")
        return _default_result("Fabric verification error")


def _default_result(issue: str) -> Dict[str, Any]:
    """Return a safe default when verification can't proceed."""
    return {
        "anchor_fabric_appearance": "unknown",
        "catalog_fabric_appearance": "unknown",
        "fabric_identifiable": True,  # Don't block on failures
        "fabric_matches_anchor": True,
        "fabric_matches_declared": True,
        "confidence": 0.0,
        "issue": issue,
        "recommendation": None,
        "action": "NONE",
    }
