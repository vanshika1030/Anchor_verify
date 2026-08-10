#!/usr/bin/env python3
"""One-command model fetch for the verification-network deep channels.

The worker (services/ai_server.py) boots and serves the math channels —
colour delta-E and FFT print geometry — with no downloads at all. Running
this script adds the deep channels:

  DINOv2-S/14        (~90 MB)  identity channel: same-object embeddings
  Marqo-FashionCLIP  (~600 MB) identity + zero-shot attribute channel

Weights land in the standard Hugging Face cache, so the worker finds them
automatically on its next start. Anonymous downloads work; set HF_TOKEN only
if you ever hit anonymous rate limits.

Usage:  python scripts/fetch_models.py
"""

import sys


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


def main():
    results = [
        fetch("DINOv2-S/14 (identity embeddings)", fetch_dinov2),
        fetch("Marqo-FashionCLIP (fashion embeddings + zero-shot)", fetch_fashionclip),
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
