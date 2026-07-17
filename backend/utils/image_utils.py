"""
Anchor — Image utility functions for preprocessing, masking, and compositing.
"""
import io
import base64
from PIL import Image
import numpy as np


def load_image_from_bytes(image_bytes: bytes) -> Image.Image:
    """Load a PIL Image from raw bytes."""
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def load_image_from_path(path: str) -> Image.Image:
    """Load a PIL Image from a file path."""
    return Image.open(path).convert("RGB")


def image_to_bytes(image: Image.Image, format: str = "PNG") -> bytes:
    """Convert a PIL Image to bytes."""
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return buffer.getvalue()


def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert a PIL Image to a base64-encoded string."""
    img_bytes = image_to_bytes(image, format)
    return base64.b64encode(img_bytes).decode("utf-8")


def resize_for_model(image: Image.Image, max_size: int = 1024) -> Image.Image:
    """Resize image to max dimension while preserving aspect ratio.
    Used before sending to Gemini to reduce token cost."""
    w, h = image.size
    if max(w, h) <= max_size:
        return image
    scale = max_size / max(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return image.resize((new_w, new_h), Image.LANCZOS)


def apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    """Apply a binary mask to an image, returning RGBA with transparent background."""
    image = image.convert("RGBA")
    mask_arr = np.array(mask.convert("L"))
    img_arr = np.array(image)
    # Set alpha channel based on mask
    img_arr[:, :, 3] = mask_arr
    return Image.fromarray(img_arr)


def create_white_background(image: Image.Image) -> Image.Image:
    """Convert RGBA image to RGB with white background."""
    if image.mode != "RGBA":
        return image.convert("RGB")
    background = Image.new("RGB", image.size, (255, 255, 255))
    background.paste(image, mask=image.split()[3])  # Use alpha as mask
    return background


def create_styled_background(
    garment_cutout: Image.Image,
    bg_color: tuple = (245, 245, 245),
    padding_pct: float = 0.1,
) -> Image.Image:
    """Place a garment cutout on a clean, styled background.
    This is the fallback generation method — 100% garment-accurate."""
    if garment_cutout.mode != "RGBA":
        garment_cutout = garment_cutout.convert("RGBA")

    # Calculate canvas size with padding
    w, h = garment_cutout.size
    pad_x = int(w * padding_pct)
    pad_y = int(h * padding_pct)
    canvas_w = w + 2 * pad_x
    canvas_h = h + 2 * pad_y

    # Create background
    canvas = Image.new("RGB", (canvas_w, canvas_h), bg_color)

    # Center the garment
    canvas.paste(garment_cutout, (pad_x, pad_y), garment_cutout)

    return canvas


def composite_side_by_side(
    image1: Image.Image,
    image2: Image.Image,
    label1: str = "Anchor",
    label2: str = "Catalog",
    max_height: int = 600,
) -> Image.Image:
    """Create a side-by-side comparison image."""
    # Resize both to same height
    ratio1 = max_height / image1.height
    ratio2 = max_height / image2.height

    img1 = image1.resize(
        (int(image1.width * ratio1), max_height), Image.LANCZOS
    )
    img2 = image2.resize(
        (int(image2.width * ratio2), max_height), Image.LANCZOS
    )

    # Create canvas
    gap = 20
    total_w = img1.width + gap + img2.width
    canvas = Image.new("RGB", (total_w, max_height), (15, 15, 20))

    canvas.paste(img1, (0, 0))
    canvas.paste(img2, (img1.width + gap, 0))

    return canvas
