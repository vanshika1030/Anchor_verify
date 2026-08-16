#!/usr/bin/env python3
"""One-command model fetch for the verification-network deep channels.

The worker (services/ai_server.py) boots and serves the math channels —
colour delta-E and FFT print geometry — with no downloads at all. Running
this script adds the deep channels:

  DINOv2-S/14                (~90 MB)  identity channel: same-object embeddings
  Marqo-FashionCLIP           (~600 MB) identity + zero-shot attribute channel
  SegFormer-B2 clothes        (~109 MB) Layer 0 garment-only segmentation
  MediaPipe Pose Landmarker   (~3 MB)   Layer 0 body landmark analysis

Weights land in the standard Hugging Face cache, so the worker finds them
automatically on its next start. Anonymous downloads work; set HF_TOKEN only
if you ever hit anonymous rate limits.

Usage:  python scripts/fetch_models.py
"""

import sys
from pathlib import Path
from urllib.request import urlretrieve


def fetch(label, fn):
    print(f"→ {label} ...")
    try:
        fn()
        print(f"  OK: {label}")
        return True
    except Exception as e:
        print(f"  FAILED: {label}: {e}")
        return False


def fetch_dinov2():
    import timm
    model = timm.create_model("vit_small_patch14_dinov2.lvd142m", pretrained=True, num_classes=0)
    assert model is not None


def fetch_fashionclip():
    import open_clip
    model, _, _ = open_clip.create_model_and_transforms("hf-hub:Marqo/marqo-fashionCLIP")
    assert model is not None


def fetch_segformer_b2_clothes():
    from transformers import AutoImageProcessor, SegformerForSemanticSegmentation

    model_id = "mattmdjaga/segformer_b2_clothes"
    processor = AutoImageProcessor.from_pretrained(model_id)
    model = SegformerForSemanticSegmentation.from_pretrained(model_id)
    assert processor is not None and model is not None


def fetch_mediapipe_pose_landmarker():
    destination = Path(__file__).resolve().parents[1] / "services" / "models" / "pose_landmarker_lite.task"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 100_000:
        return
    # Official MediaPipe model storage. The runtime reads this local asset; it
    # never downloads it while serving a verification request.
    urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
        "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        destination,
    )
    if not destination.exists() or destination.stat().st_size <= 100_000:
        raise RuntimeError("Downloaded Pose Landmarker file is unexpectedly small")


def main():
    results = [
        fetch("DINOv2-S/14 (identity embeddings)", fetch_dinov2),
        fetch("Marqo-FashionCLIP (fashion embeddings + zero-shot)", fetch_fashionclip),
        fetch("SegFormer-B2 clothes (Layer 0 garment mask)", fetch_segformer_b2_clothes),
        fetch("MediaPipe Pose Landmarker (Layer 0 silhouette)", fetch_mediapipe_pose_landmarker),
    ]
    if all(results):
        print("\nAll deep-channel weights cached. Restart the worker:  python services/ai_server.py")
        return 0
    print("\nSome downloads failed — the worker still runs with whatever is cached, "
          "plus the always-on math channels. Re-run this script on a network that "
          "can reach huggingface.co.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
