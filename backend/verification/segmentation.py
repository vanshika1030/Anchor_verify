"""
Garment segmentation via rembg background removal.

Uses rembg (u2net under the hood) as a lightweight, CPU-friendly alternative
to SAM for isolating garments from their backgrounds.  Returns an RGBA
image with the background made transparent, plus a confidence score
derived from the ratio of opaque pixels to total pixels.
"""

from __future__ import annotations

import logging
from typing import Tuple

import numpy as np
from PIL import Image
from rembg import remove

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import SAM_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)


def _foreground_ratio(rgba_image: Image.Image) -> float:
    """Return the fraction of pixels that are opaque (alpha > 128).

    A very low ratio usually means the model couldn't find a clear
    foreground object, so we treat this as a confidence proxy.
    """
    alpha = np.array(rgba_image.split()[-1])  # alpha channel
    opaque_pixels = int(np.sum(alpha > 128))
    total_pixels = alpha.size
    if total_pixels == 0:
        return 0.0
    return opaque_pixels / total_pixels


def segment_garment(image: Image.Image) -> Tuple[Image.Image, float]:
    """Remove the background from a garment photograph.

    Parameters
    ----------
    image : PIL.Image.Image
        Input image in any mode (RGB, RGBA, etc.).

    Returns
    -------
    cutout : PIL.Image.Image
        RGBA image with transparent background.
    confidence : float
        Heuristic confidence in the range ``[0.0, 1.0]``.  Derived from the
        fraction of opaque foreground pixels.  If the value falls below
        ``SAM_CONFIDENCE_THRESHOLD`` the original image is returned
        alongside the low score so callers can decide to fall back.
    """
    try:
        # rembg.remove returns an RGBA PIL image when given a PIL image.
        rgba_input = image.convert("RGBA")
        cutout: Image.Image = remove(rgba_input)

        fg_ratio = _foreground_ratio(cutout)

        # Map fg_ratio to a 0-1 confidence.
        # Ideal garment photos typically have 20-70 % foreground.
        # A ratio outside that band is suspicious.
        if 0.10 <= fg_ratio <= 0.85:
            confidence = min(1.0, 0.5 + fg_ratio)  # generous mapping
        else:
            confidence = fg_ratio * 0.5  # penalise extreme ratios

        if confidence < SAM_CONFIDENCE_THRESHOLD:
            logger.warning(
                "Low segmentation confidence (%.2f < %.2f). "
                "Returning original image.",
                confidence,
                SAM_CONFIDENCE_THRESHOLD,
            )
            return image.convert("RGBA"), confidence

        return cutout, confidence

    except Exception:
        logger.exception("Segmentation failed; returning original image.")
        return image.convert("RGBA"), 0.0
