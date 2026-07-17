"""
Visual similarity via MobileNetV2 embeddings.

Extracts deep feature vectors from garment images using a pretrained
MobileNetV2 backbone (classifier head removed), then computes cosine
similarity as a holistic "do these look like the same garment?" signal.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

logger = logging.getLogger(__name__)

# ── Preprocessing pipeline matching ImageNet training stats ───────────────
_preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])

# Module-level model cache so we only load once.
_model: Optional[nn.Module] = None


def load_embedder() -> nn.Module:
    """Load a pretrained MobileNetV2 with classifier replaced by identity.

    The resulting model outputs a 1280-dimensional feature vector for
    each input image.  The model is cached at module level.
    """
    global _model
    if _model is not None:
        return _model

    logger.info("Loading MobileNetV2 embedder…")
    base = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
    base.classifier = nn.Identity()  # strip the 1000-class head
    base.eval()

    _model = base
    return _model


def get_embedding(model: nn.Module, image: Image.Image) -> np.ndarray:
    """Extract a 1280-dim feature vector from an image.

    Parameters
    ----------
    model : nn.Module
        MobileNetV2 model returned by :func:`load_embedder`.
    image : PIL.Image.Image
        Garment image (RGB or RGBA — converted automatically).

    Returns
    -------
    numpy.ndarray
        1-D float32 array of shape ``(1280,)``.
    """
    rgb = image.convert("RGB")
    tensor = _preprocess(rgb).unsqueeze(0)  # (1, 3, 224, 224)

    with torch.no_grad():
        features = model(tensor)  # (1, 1280)

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
    # Clamp to [0, 1] — cosine can go slightly negative for very
    # different images; we treat that as "zero similarity".
    return max(0.0, min(1.0, similarity))
