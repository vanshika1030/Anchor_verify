"""
Visual similarity via CLIP embeddings.

Extracts deep feature vectors from garment images using OpenAI's CLIP 
(ViT-B/32), then computes cosine similarity for highly accurate semantic 
and textural matching between anchor and catalog fabrics.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

logger = logging.getLogger(__name__)

# Module-level model cache so we only load once.
_model = None
_processor = None

def load_embedder():
    """Load pretrained CLIP model (ViT-B/32) and processor.
    The model is cached at module level.
    """
    global _model, _processor
    if _model is not None and _processor is not None:
        return _model, _processor

    logger.info("Loading CLIP embedder (openai/clip-vit-base-patch32)…")
    # Using the standard OpenAI CLIP model from HuggingFace
    _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    _model.eval()

    return _model, _processor


def get_embedding(model_and_processor, image: Image.Image) -> np.ndarray:
    """Extract a feature vector from an image using CLIP.

    Parameters
    ----------
    model_and_processor : tuple
        (CLIPModel, CLIPProcessor) returned by load_embedder.
    image : PIL.Image.Image
        Garment image.

    Returns
    -------
    numpy.ndarray
        1-D float32 array (512-dimensional for ViT-B/32).
    """
    model, processor = model_and_processor
    rgb = image.convert("RGB")
    
    # Process image
    inputs = processor(images=rgb, return_tensors="pt")

    with torch.no_grad():
        # Get image features
        features = model.get_image_features(**inputs)
        # Normalize features
        features = features / features.norm(p=2, dim=-1, keepdim=True)

    return features.squeeze(0).numpy().astype(np.float32)


def compute_similarity(
    embedding1: np.ndarray,
    embedding2: np.ndarray,
) -> float:
    """Cosine similarity between two embedding vectors.

    Returns
    -------
    float
        Value in ``[0.0, 1.0]`` where 1.0 = identical.
    """
    dot = np.dot(embedding1, embedding2)
    norm1 = np.linalg.norm(embedding1)
    norm2 = np.linalg.norm(embedding2)

    if norm1 == 0 or norm2 == 0:
        return 0.0

    similarity = float(dot / (norm1 * norm2))
    return max(0.0, min(1.0, similarity))
