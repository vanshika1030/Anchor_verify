"""
CLIP visual similarity + zero-shot attribute extraction.
Uses open_clip (no HuggingFace transformers dependency).

Modes:
  python clip_similarity_cli.py <anchor_path> <catalog_path>
      → Compares two images, returns cosine similarity score.

  python clip_similarity_cli.py --zero-shot <image_path>
      → Extracts garment attributes via zero-shot classification.
"""
import sys
import json
import warnings
warnings.filterwarnings("ignore")

# ─── Attribute label sets for zero-shot classification ─────────────
ZERO_SHOT_ATTRIBUTES = {
    "pattern_type": [
        "Solid", "Floral", "Striped", "Checked", "Polka Dot",
        "Geometric", "Abstract", "Paisley", "Animal Print",
        "Block Print", "Ethnic Motif", "Colorblocked", "Embroidered", "Self-design"
    ],
    "fit": ["Slim", "Regular", "Relaxed", "Oversized"],
    "silhouette": [
        "A-Line", "Straight", "Fit and Flare", "Bodycon",
        "Peplum", "Asymmetric", "Wrap", "Sheath"
    ],
    "embellishment": [
        "None", "Embroidery", "Sequins", "Beadwork",
        "Mirror Work", "Zari", "Lace Trim", "Tassels", "Buttons"
    ],
    "hemline": [
        "Straight", "Curved", "Asymmetric", "High-Low", "Scalloped", "Ruffled"
    ],
    "transparency": ["Opaque", "Semi-Sheer", "Sheer"],
    "occasion_style": [
        "Casual", "Formal", "Party", "Ethnic", "Festive", "Office", "Lounge"
    ],
    "secondary_color": [
        "None", "Black", "White", "Red", "Pink", "Green",
        "Yellow", "Orange", "Purple", "Brown", "Grey", "Beige",
        "Gold", "Silver", "Multi-color"
    ],
    "motif_description": [
        "None", "Floral", "Paisley", "Geometric", "Animal",
        "Abstract", "Tribal", "Mandala", "Botanical", "Birds"
    ],
    "closure_type": [
        "Slip On", "Button", "Zip", "Tie-Up", "Hook and Eye", "Drawstring", "Wrap"
    ],
    "structural_features": [
        "None", "Pleats", "Gathers", "Pintucks", "Darts",
        "Side Slits", "Pockets", "Belt or Sash", "Layered"
    ],
    "model_build": [
        "Slim petite build model", "Average regular build model", "Plus size curvy build model"
    ],
    "model_height_range": [
        "Petite model under 5 feet 4 inches", "Average height model 5 feet 4 to 5 feet 7", "Tall model over 5 feet 7 inches"
    ],
}

# Prompt templates for zero-shot (CLIP understands these well)
PROMPT_TEMPLATES = {
    "pattern_type": "A photo of a garment with a {} pattern",
    "fit": "A photo of a {} fit garment",
    "silhouette": "A photo of a garment with {} silhouette",
    "embellishment": "A photo of a garment with {} embellishment",
    "hemline": "A photo of a garment with a {} hemline",
    "transparency": "A photo of an {} garment",
    "occasion_style": "A photo of a {} wear garment",
    "secondary_color": "A photo of a garment with {} as secondary color",
    "motif_description": "A photo of a garment with {} motif",
    "closure_type": "A photo of a garment with {} closure",
    "structural_features": "A photo of a garment with {} structural feature",
    "model_build": "A photo of a {}",
    "model_height_range": "A photo of a {}",
}

def run_similarity(anchor_path, catalog_path):
    """Compare two images using CLIP cosine similarity."""
    import torch
    import open_clip
    from PIL import Image

    model, _, preprocess = open_clip.create_model_and_transforms(
        'ViT-B-32', pretrained='laion2b_s34b_b79k'
    )
    model.eval()

    anchor_img = preprocess(Image.open(anchor_path).convert("RGB")).unsqueeze(0)
    catalog_img = preprocess(Image.open(catalog_path).convert("RGB")).unsqueeze(0)

    with torch.no_grad():
        anchor_feat = model.encode_image(anchor_img)
        catalog_feat = model.encode_image(catalog_img)

        anchor_feat = anchor_feat / anchor_feat.norm(dim=-1, keepdim=True)
        catalog_feat = catalog_feat / catalog_feat.norm(dim=-1, keepdim=True)

        similarity = (anchor_feat @ catalog_feat.T).item()
        similarity = max(0.0, min(1.0, similarity))

    print(json.dumps({
        "success": True,
        "similarity_score": round(similarity, 4),
        "is_match": similarity > 0.65
    }))


def run_zero_shot(image_path):
    """Extract garment attributes using CLIP zero-shot classification."""
    import torch
    import open_clip
    from PIL import Image

    model, _, preprocess = open_clip.create_model_and_transforms(
        'ViT-B-32', pretrained='laion2b_s34b_b79k'
    )
    tokenizer = open_clip.get_tokenizer('ViT-B-32')
    model.eval()

    img = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0)

    with torch.no_grad():
        image_features = model.encode_image(img)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    result = {}

    for attr_name, labels in ZERO_SHOT_ATTRIBUTES.items():
        template = PROMPT_TEMPLATES.get(attr_name, "A photo of a garment that is {}")
        text_prompts = [template.format(label) for label in labels]
        text_tokens = tokenizer(text_prompts)

        with torch.no_grad():
            text_features = model.encode_text(text_tokens)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            # Cosine similarity → softmax probabilities
            logits = (image_features @ text_features.T).squeeze(0) * 100.0
            probs = torch.softmax(logits, dim=0)

            best_idx = probs.argmax().item()
            best_conf = probs[best_idx].item()

        result[attr_name] = {
            "value": labels[best_idx],
            "confidence": round(best_conf, 4)
        }

    print(json.dumps({"success": True, "attributes": result}))


def run_binary_batch(image_path, pairs_json):
    """Batch binary cross-verification: check multiple label pairs in ONE model load."""
    import torch
    import open_clip
    from PIL import Image

    pairs = json.loads(pairs_json)  # [{"key": "fabric", "a": "Cotton", "b": "polyester"}, ...]

    model, _, preprocess = open_clip.create_model_and_transforms(
        'ViT-B-32', pretrained='laion2b_s34b_b79k'
    )
    tokenizer = open_clip.get_tokenizer('ViT-B-32')
    model.eval()

    img = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0)

    with torch.no_grad():
        image_features = model.encode_image(img)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    results = {}

    for pair in pairs:
        key = pair["key"]
        label_a = pair["a"]
        label_b = pair["b"]

        text_prompts = [
            f"A photo of a garment that is {label_a}",
            f"A photo of a garment that is {label_b}"
        ]
        text_tokens = tokenizer(text_prompts)

        with torch.no_grad():
            text_features = model.encode_text(text_tokens)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            logits = (image_features @ text_features.T).squeeze(0) * 100.0
            probs = torch.softmax(logits, dim=0)

        conf_a = probs[0].item()
        conf_b = probs[1].item()

        if conf_a >= 0.60:
            winner = label_a
        elif conf_b >= 0.60:
            winner = label_b
        else:
            winner = "uncertain"

        results[key] = {
            "winner": winner,
            "confidence_a": round(conf_a, 4),
            "confidence_b": round(conf_b, 4)
        }

    print(json.dumps({"success": True, "results": results}))


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: clip_similarity_cli.py [--zero-shot|--binary-batch] <path1> [path2|json]"}))
        sys.exit(1)

    try:
        if sys.argv[1] == "--zero-shot":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Usage: clip_similarity_cli.py --zero-shot <image_path>"}))
                sys.exit(1)
            run_zero_shot(sys.argv[2])
        elif sys.argv[1] == "--binary-batch":
            if len(sys.argv) < 4:
                print(json.dumps({"error": "Usage: clip_similarity_cli.py --binary-batch <image_path> <json_pairs>"}))
                sys.exit(1)
            run_binary_batch(sys.argv[2], sys.argv[3])
        else:
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Usage: clip_similarity_cli.py <anchor_path> <catalog_path>"}))
                sys.exit(1)
            run_similarity(sys.argv[1], sys.argv[2])
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()

