"""
Anchor — FastAPI Backend

Exposes the verification and generation pipelines as REST endpoints.
All image I/O is multipart form uploads → JSON responses.
"""

from __future__ import annotations

import io
import json
import time
import base64
import logging
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image

# ── Local modules ─────────────────────────────────────────────────────────
from verification.segmentation import segment_garment
from verification.attributes import extract_attributes
from verification.three_way_compare import compare_attributes
from verification.fabric import verify_fabric
from verification.embeddings import load_embedder, get_embedding, compute_similarity
from verification.localization import localize_mismatches
from verification.verdict import generate_verdict
from verification.size_chart import check_size_chart
from generation.catalog_gen import try_generate_with_fallback, create_fallback_catalog
from generation.metadata_gen import generate_metadata
from utils.image_utils import resize_for_model, image_to_base64, create_white_background

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App Setup ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Anchor — Myntra Verification API",
    description="Verification and generation pipeline for trusted fashion catalogs",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pre-load the embedding model at startup
embedder = None


@app.on_event("startup")
async def startup():
    global embedder
    logger.info("Loading MobileNetV2 embedder...")
    embedder = load_embedder()
    logger.info("Embedder loaded.")


# ── Helper ────────────────────────────────────────────────────────────────

def _read_image(file: UploadFile) -> Image.Image:
    """Read an uploaded file into a PIL Image."""
    contents = file.file.read()
    return Image.open(io.BytesIO(contents)).convert("RGB")


def _img_b64(image: Image.Image, max_size: int = 800) -> str:
    """Resize and base64-encode an image for JSON response."""
    resized = resize_for_model(image, max_size)
    return image_to_base64(resized, format="JPEG")


# ══════════════════════════════════════════════════════════════════════════
#  ENDPOINT 1: Full Verification Pipeline
# ══════════════════════════════════════════════════════════════════════════

@app.post("/api/verify")
async def verify_listing(
    anchor_image: UploadFile = File(..., description="Real product photo"),
    catalog_image: UploadFile = File(..., description="Catalog/listing image"),
    declared_metadata: str = Form(
        default="{}",
        description="JSON string of seller-declared attributes",
    ),
):
    """Run the full three-way verification pipeline.

    Accepts:
      - anchor_image: the real product photo (multipart file)
      - catalog_image: the catalog/listing image to verify (multipart file)
      - declared_metadata: JSON string of seller-declared attributes

    Returns:
      - Complete verification verdict with comparison table, fabric result,
        similarity score, localizations, and recommendations.
    """
    start = time.time()
    steps_completed = []

    try:
        # Parse declared metadata
        try:
            declared_attrs = json.loads(declared_metadata)
        except json.JSONDecodeError:
            declared_attrs = {}

        # ── Step 1: Load images ──────────────────────────────────────
        anchor_img = _read_image(anchor_image)
        catalog_img = _read_image(catalog_image)
        steps_completed.append("images_loaded")

        # ── Step 2: Segment garments ─────────────────────────────────
        anchor_prep = resize_for_model(anchor_img)
        catalog_prep = resize_for_model(catalog_img)

        anchor_cutout, anchor_conf = segment_garment(anchor_prep)
        catalog_cutout, catalog_conf = segment_garment(catalog_prep)
        steps_completed.append("garments_segmented")

        # ── Step 3: Extract attributes ───────────────────────────────
        anchor_rgb = create_white_background(anchor_cutout)
        catalog_rgb = create_white_background(catalog_cutout)

        anchor_attrs = extract_attributes(anchor_rgb)
        catalog_attrs = extract_attributes(catalog_rgb)
        steps_completed.append("attributes_extracted")

        # ── Step 4: Three-way comparison ─────────────────────────────
        comparison = compare_attributes(anchor_attrs, catalog_attrs, declared_attrs)
        steps_completed.append("comparison_done")

        # ── Step 5: Fabric verification ──────────────────────────────
        declared_fabric = declared_attrs.get(
            "fabric",
            declared_attrs.get("fabric_composition", "unknown"),
        )
        fabric_result = verify_fabric(anchor_rgb, catalog_rgb, declared_fabric)
        steps_completed.append("fabric_verified")

        # ── Step 6: Embedding similarity ─────────────────────────────
        anchor_emb = get_embedding(embedder, anchor_rgb)
        catalog_emb = get_embedding(embedder, catalog_rgb)
        similarity = compute_similarity(anchor_emb, catalog_emb)
        steps_completed.append("similarity_computed")

        # ── Step 7: Localize mismatches ──────────────────────────────
        mismatches = [r for r in comparison if r["status"] == "MISMATCH"]
        localizations = localize_mismatches(catalog_img, mismatches)
        steps_completed.append("mismatches_localized")

        # ── Step 8: Generate verdict ─────────────────────────────────
        verdict = generate_verdict(
            comparison, fabric_result, similarity, localizations
        )
        steps_completed.append("verdict_generated")

        elapsed = time.time() - start

        return JSONResponse({
            "success": True,
            "elapsed_seconds": round(elapsed, 2),
            "steps_completed": steps_completed,
            "verdict": verdict,
            "segmentation": {
                "anchor_confidence": round(anchor_conf, 3),
                "catalog_confidence": round(catalog_conf, 3),
            },
            "extracted_attributes": {
                "anchor": anchor_attrs,
                "catalog": catalog_attrs,
            },
            "images": {
                "anchor_cutout": _img_b64(anchor_rgb),
                "catalog_cutout": _img_b64(catalog_rgb),
            },
        })

    except Exception as e:
        logger.exception("Verification pipeline error")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "steps_completed": steps_completed,
            },
        )


# ══════════════════════════════════════════════════════════════════════════
#  ENDPOINT 2: Smart Attribute Extraction (for the confirmation screen)
# ══════════════════════════════════════════════════════════════════════════

@app.post("/api/extract-attributes")
async def extract_image_attributes(
    image: UploadFile = File(..., description="Product/anchor image"),
):
    """Extract structured attributes from a product image.

    Used in the seller confirmation flow — auto-detects visual attributes
    so the seller can review and confirm them before generation.
    """
    try:
        img = _read_image(image)
        img_resized = resize_for_model(img)

        # Segment
        cutout, confidence = segment_garment(img_resized)
        cutout_rgb = create_white_background(cutout)

        # Extract
        attributes = extract_attributes(cutout_rgb)

        return JSONResponse({
            "success": True,
            "attributes": attributes,
            "segmentation_confidence": round(confidence, 3),
            "garment_cutout": _img_b64(cutout_rgb),
        })

    except Exception as e:
        logger.exception("Attribute extraction error")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════
#  ENDPOINT 3: Generate Catalog Image + Metadata
# ══════════════════════════════════════════════════════════════════════════

@app.post("/api/generate")
async def generate_catalog(
    anchor_image: UploadFile = File(..., description="Real product photo"),
    confirmed_attributes: str = Form(
        ..., description="JSON string of seller-confirmed attributes"
    ),
    model_height: str = Form(default="5'6\""),
    model_size: str = Form(default="M"),
):
    """Generate a catalog image and listing metadata from an anchor photo.

    Flow:
    1. Segment garment from anchor
    2. Generate catalog image (Gemini reference-based, with fallback)
    3. Generate metadata (title, description, tags, SKU fields)
    4. Auto-verify the generated catalog against anchor
    5. Return everything
    """
    start = time.time()

    try:
        attrs = json.loads(confirmed_attributes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON for confirmed_attributes")

    try:
        # ── Step 1: Load and segment ─────────────────────────────────
        anchor_img = _read_image(anchor_image)
        anchor_prep = resize_for_model(anchor_img)
        cutout, seg_conf = segment_garment(anchor_prep)

        # ── Step 2: Generate catalog image ───────────────────────────
        catalog_img, source = try_generate_with_fallback(
            cutout, attrs, model_height, model_size
        )

        # ── Step 3: Generate metadata ────────────────────────────────
        metadata = generate_metadata(attrs)

        # ── Step 4: Auto-verify ──────────────────────────────────────
        cutout_rgb = create_white_background(cutout)
        catalog_rgb = catalog_img.convert("RGB")

        anchor_attrs = extract_attributes(cutout_rgb)
        catalog_attrs = extract_attributes(catalog_rgb)
        comparison = compare_attributes(anchor_attrs, catalog_attrs, attrs)

        declared_fabric = attrs.get("fabric", attrs.get("fabric_composition", "unknown"))
        fabric_result = verify_fabric(cutout_rgb, catalog_rgb, declared_fabric)

        anchor_emb = get_embedding(embedder, cutout_rgb)
        catalog_emb = get_embedding(embedder, catalog_rgb)
        similarity = compute_similarity(anchor_emb, catalog_emb)

        mismatches = [r for r in comparison if r["status"] == "MISMATCH"]
        localizations = localize_mismatches(catalog_img, mismatches)
        verdict = generate_verdict(comparison, fabric_result, similarity, localizations)

        elapsed = time.time() - start

        return JSONResponse({
            "success": True,
            "elapsed_seconds": round(elapsed, 2),
            "generation": {
                "source": source,
                "catalog_image": _img_b64(catalog_img),
                "metadata": metadata,
            },
            "verification": verdict,
            "images": {
                "anchor_cutout": _img_b64(cutout_rgb),
                "catalog_generated": _img_b64(catalog_img),
            },
        })

    except Exception as e:
        logger.exception("Generation pipeline error")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════
#  ENDPOINT 4: Size Chart Validation
# ══════════════════════════════════════════════════════════════════════════

@app.post("/api/validate-size-chart")
async def validate_size_chart(
    size_chart: str = Form(..., description="JSON string of size chart"),
):
    """Validate proportional consistency of a size chart."""
    try:
        chart = json.loads(size_chart)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON for size_chart")

    result = check_size_chart(chart)
    return JSONResponse({"success": True, "result": result})


# ══════════════════════════════════════════════════════════════════════════
#  ENDPOINT 5: Health Check
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    """Basic health check."""
    return {
        "status": "ok",
        "embedder_loaded": embedder is not None,
    }


# ── Run ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
