"""
CLIP visual similarity check using open_clip (no HuggingFace transformers dependency).
Compares two images and returns a cosine similarity score.
Usage: python clip_similarity_cli.py <anchor_path> <catalog_path>
"""
import sys
import json
import warnings
warnings.filterwarnings("ignore")

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: clip_similarity_cli.py <anchor_path> <catalog_path>"}))
        sys.exit(1)

    anchor_path = sys.argv[1]
    catalog_path = sys.argv[2]

    try:
        import torch
        import open_clip
        from PIL import Image

        # Load model — ViT-B-32 pretrained on LAION-2B (excellent general-purpose)
        model, _, preprocess = open_clip.create_model_and_transforms(
            'ViT-B-32', pretrained='laion2b_s34b_b79k'
        )
        model.eval()

        anchor_img = preprocess(Image.open(anchor_path).convert("RGB")).unsqueeze(0)
        catalog_img = preprocess(Image.open(catalog_path).convert("RGB")).unsqueeze(0)

        with torch.no_grad():
            anchor_feat = model.encode_image(anchor_img)
            catalog_feat = model.encode_image(catalog_img)

            # L2 normalize
            anchor_feat = anchor_feat / anchor_feat.norm(dim=-1, keepdim=True)
            catalog_feat = catalog_feat / catalog_feat.norm(dim=-1, keepdim=True)

            similarity = (anchor_feat @ catalog_feat.T).item()
            similarity = max(0.0, min(1.0, similarity))

        # Threshold: 0.65 is a good boundary for "same garment vs different garment"
        # CLIP cosine sim for same-garment-different-angle is typically 0.70-0.97
        # Completely different garments are typically < 0.60
        print(json.dumps({
            "success": True,
            "similarity_score": round(similarity, 4),
            "is_match": similarity > 0.65
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
