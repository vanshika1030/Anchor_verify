import sys
import json
import logging
import warnings
# Suppress the warnings about metadata
warnings.filterwarnings("ignore")

try:
    import numpy as np
    import torch
    from PIL import Image
    from transformers import CLIPProcessor, CLIPModel
except ImportError as e:
    print(json.dumps({"error": f"Import error: {str(e)}"}))
    sys.exit(1)

# Suppress transformer logs
logging.getLogger("transformers").setLevel(logging.ERROR)

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Anchor and catalog image paths required."}))
        sys.exit(1)

    anchor_path = sys.argv[1]
    catalog_path = sys.argv[2]
    
    try:
        # Load the model
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        model.eval()

        anchor_img = Image.open(anchor_path).convert("RGB")
        catalog_img = Image.open(catalog_path).convert("RGB")
        
        inputs = processor(images=[anchor_img, catalog_img], return_tensors="pt")
        
        with torch.no_grad():
            features = model.get_image_features(**inputs)
            features = features / features.norm(p=2, dim=-1, keepdim=True)
            
        feat_np = features.numpy().astype(np.float32)
        emb1 = feat_np[0]
        emb2 = feat_np[1]
        
        dot = np.dot(emb1, emb2)
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        
        if norm1 == 0 or norm2 == 0:
            similarity = 0.0
        else:
            similarity = float(dot / (norm1 * norm2))
            similarity = max(0.0, min(1.0, similarity))
            
        print(json.dumps({
            "success": True,
            "similarity_score": similarity,
            "is_match": similarity > 0.85
        }))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
