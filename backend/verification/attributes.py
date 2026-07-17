"""
Structured garment-attribute extraction via Gemini 2.5 Flash.

Sends a garment image to the Gemini vision model and requests a
structured JSON response matching the schema defined in
``ATTRIBUTE_EXTRACTION_PROMPT``.
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
from config import GEMINI_API_KEY, ATTRIBUTE_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)

# Configure the SDK once at module import.
genai.configure(api_key=GEMINI_API_KEY)


def _image_to_part(image: Image.Image, mime_type: str = "image/png") -> dict:
    """Convert a PIL image to a Gemini-compatible inline data part."""
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return {
        "inline_data": {
            "mime_type": mime_type,
            "data": buf.getvalue(),
        }
    }


def extract_attributes(image: Image.Image) -> Dict[str, Any]:
    """Extract structured garment attributes from an image using Gemini.

    Parameters
    ----------
    image : PIL.Image.Image
        Garment image (ideally with background removed).

    Returns
    -------
    dict
        Parsed JSON dictionary with keys such as ``garment_type``,
        ``sleeve_type``, ``pattern``, etc.  On failure an empty dict is
        returned so downstream code can treat missing attributes as
        ``None``.
    """
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY is not set. Cannot extract attributes.")
        return {}

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.2,
            },
        )

        # Build multimodal request: text prompt + image.
        image_part = _image_to_part(image.convert("RGB"))
        response = model.generate_content(
            [ATTRIBUTE_EXTRACTION_PROMPT, image_part],
        )

        # Parse the structured JSON response.
        raw_text: str = response.text.strip()
        attributes: Dict[str, Any] = json.loads(raw_text)
        logger.info("Extracted %d attributes from image.", len(attributes))
        return attributes

    except json.JSONDecodeError as exc:
        logger.error("Gemini returned non-JSON response: %s", exc)
        return {}
    except Exception:
        logger.exception("Attribute extraction failed.")
        return {}
