"""
Anchor — Catalog image generation using Gemini with reference-based approach.
Sends the SAM-segmented garment cutout as a visual reference alongside
structured attribute constraints to generate accurate on-model catalog images.
Falls back to styled SAM cutout on professional background if generation fails verification.
"""
import io
import json
from typing import Optional
from PIL import Image
import google.generativeai as genai

from config import GEMINI_API_KEY, CATALOG_GENERATION_PROMPT

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)


def generate_catalog_image(
    garment_cutout: Image.Image,
    confirmed_attributes: dict,
    model_height: str = "5'6\"",
    model_size: str = "M",
) -> Optional[Image.Image]:
    """Generate a catalog image using Gemini with the garment cutout as visual reference.
    
    Args:
        garment_cutout: SAM-segmented garment image (RGBA with transparent bg)
        confirmed_attributes: Dict of seller-confirmed attributes
        model_height: Declared model height for generation
        model_size: Declared model size
        
    Returns:
        Generated catalog image, or None if generation fails
    """
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")

        # Build the prompt with confirmed attributes
        prompt = CATALOG_GENERATION_PROMPT.format(
            height=model_height,
            size=model_size,
            garment_type=confirmed_attributes.get("garment_type", "garment"),
            sleeve_type=confirmed_attributes.get("sleeve_type", "unknown"),
            neck_type=confirmed_attributes.get("neck_type", "unknown"),
            pattern=confirmed_attributes.get("pattern", "unknown"),
            fabric=confirmed_attributes.get("fabric_appearance", "unknown"),
            fit_type=confirmed_attributes.get("fit_type", "regular"),
            silhouette=confirmed_attributes.get("silhouette", "straight"),
            primary_color=confirmed_attributes.get("primary_color", "unknown"),
        )

        # Convert cutout to RGB for Gemini (it may not accept RGBA)
        if garment_cutout.mode == "RGBA":
            rgb_cutout = Image.new("RGB", garment_cutout.size, (255, 255, 255))
            rgb_cutout.paste(garment_cutout, mask=garment_cutout.split()[3])
        else:
            rgb_cutout = garment_cutout.convert("RGB")

        # Send prompt + reference image to Gemini
        response = model.generate_content(
            [prompt, rgb_cutout],
            generation_config=genai.GenerationConfig(
                response_mime_type="text/plain",
            ),
        )

        # Check if response contains an image
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    image_data = part.inline_data.data
                    return Image.open(io.BytesIO(image_data)).convert("RGB")

        # If Gemini returned text instead of image (model might not support
        # image generation via this API path), return None to trigger fallback
        return None

    except Exception as e:
        print(f"[Anchor] Catalog generation failed: {e}")
        return None


def create_fallback_catalog(
    garment_cutout: Image.Image,
    bg_color: tuple = (245, 245, 245),
) -> Image.Image:
    """Create a fallback catalog image using the real garment cutout on a styled background.
    This is 100% garment-accurate — it IS the real garment.
    
    Args:
        garment_cutout: SAM-segmented garment (RGBA)
        bg_color: Background color tuple
        
    Returns:
        Styled product image with clean background
    """
    if garment_cutout.mode != "RGBA":
        garment_cutout = garment_cutout.convert("RGBA")

    w, h = garment_cutout.size

    # Add padding and create canvas
    padding_pct = 0.15
    pad_x = int(w * padding_pct)
    pad_y = int(h * padding_pct)
    canvas_w = w + 2 * pad_x
    canvas_h = h + 2 * pad_y

    # Create gradient background (subtle, professional)
    canvas = Image.new("RGB", (canvas_w, canvas_h), bg_color)

    # Add subtle shadow effect
    shadow = Image.new("RGBA", (w + 10, h + 10), (0, 0, 0, 20))
    canvas.paste(
        Image.new("RGB", (w + 10, h + 10), (200, 200, 200)),
        (pad_x + 5, pad_y + 5),
    )

    # Paste garment
    canvas.paste(garment_cutout, (pad_x, pad_y), garment_cutout)

    return canvas


def try_generate_with_fallback(
    garment_cutout: Image.Image,
    confirmed_attributes: dict,
    model_height: str = "5'6\"",
    model_size: str = "M",
) -> tuple[Image.Image, str]:
    """Try Gemini generation first, fall back to styled cutout if it fails.
    
    Returns:
        Tuple of (generated_image, source) where source is 'gemini' or 'fallback'
    """
    # Try Gemini first
    generated = generate_catalog_image(
        garment_cutout, confirmed_attributes, model_height, model_size
    )

    if generated is not None:
        return generated, "gemini"

    # Fall back to styled cutout
    fallback = create_fallback_catalog(garment_cutout)
    return fallback, "fallback"
