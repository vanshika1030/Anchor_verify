import os
import uuid
import json
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from PIL import Image
import open_clip
import imagehash
from rembg import remove
import numpy as np
import timm
from torchvision import transforms
from safetensors.torch import load_file
from contextlib import asynccontextmanager

# Global models
clip_model = None
clip_preprocess = None
clip_tokenizer = None
use_hf_clip = False  # True if using transformers CLIPModel, False if using open_clip

vit_model = None
vit_transform = None
vit_meta = None
vit_device = None

# ZERO_SHOT_ATTRIBUTES (from clip_similarity_cli.py)
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    global clip_model, clip_preprocess, clip_tokenizer, use_hf_clip
    global vit_model, vit_transform, vit_meta, vit_device
    
    # Load CLIP Model — try FashionCLIP via transformers, fallback to best open_clip
    try:
        print("[AI-SERVER] Attempting to load Marqo/marqo-fashionCLIP via open_clip...")
        clip_model, _, clip_preprocess = open_clip.create_model_and_transforms('hf-hub:Marqo/marqo-fashionCLIP')
        clip_tokenizer = open_clip.get_tokenizer('hf-hub:Marqo/marqo-fashionCLIP')
        clip_model.eval()
        use_hf_clip = False
        print("[AI-SERVER] OK: FashionCLIP loaded via open_clip")
    except Exception as e:
        print(f"[AI-SERVER] FashionCLIP not available ({e}), using best open_clip model...")
        clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
            'ViT-B-32', pretrained='datacomp_xl_s13b_b90k'
        )
        clip_tokenizer = open_clip.get_tokenizer('ViT-B-32')
        clip_model.eval()
        use_hf_clip = False
        print("[AI-SERVER] OK: CLIP ViT-B-32 (datacomp_xl) loaded")
    
    # Load ViT Model
    script_dir = os.path.dirname(os.path.abspath(__file__))
    metadata_path = os.path.join(script_dir, 'model_metadata.json')
    weights_path = os.path.join(script_dir, 'model_best.safetensors')
    
    if os.path.exists(metadata_path) and os.path.exists(weights_path):
        with open(metadata_path, 'r') as f:
            vit_meta = json.load(f)
            
        LABEL_MAPS = vit_meta['label_maps']
        
        class MultiHeadViT(nn.Module):
            def __init__(self):
                super().__init__()
                self.backbone = timm.create_model(vit_meta.get('model_name', 'vit_base_patch16_224'), pretrained=False)
                self.embed_dim = self.backbone.head.in_features
                self.backbone.head = nn.Identity()
                self.heads = nn.ModuleDict()
                for name, labels in LABEL_MAPS.items():
                    n = len(labels)
                    h = 256 if n > 8 else 128
                    self.heads[name] = nn.Sequential(
                        nn.LayerNorm(self.embed_dim),
                        nn.Dropout(0.3),
                        nn.Linear(self.embed_dim, h),
                        nn.GELU(),
                        nn.Dropout(0.2),
                        nn.Linear(h, n)
                    )
            def forward(self, x):
                features = self.backbone(x)
                return {name: head(features) for name, head in self.heads.items()}
                
        vit_device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        vit_model = MultiHeadViT()
        vit_model.load_state_dict(load_file(weights_path, device="cpu"))
        vit_model.to(vit_device)
        vit_model.eval()
        
        img_size = vit_meta.get('input_size', 224)
        vit_transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(vit_meta.get('normalize_mean', [0.485, 0.456, 0.406]), 
                                 vit_meta.get('normalize_std', [0.229, 0.224, 0.225])),
        ])
    else:
        print("Warning: ViT model files not found. ViT endpoints will fail.")
        
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CLIP abstraction helpers ──
def encode_image_clip(pil_image):
    """Encode a PIL image to a normalized feature vector."""
    if use_hf_clip:
        inputs = clip_preprocess(images=pil_image, return_tensors="pt")
        with torch.no_grad():
            feats = clip_model.get_image_features(**inputs)
        return feats / feats.norm(dim=-1, keepdim=True)
    else:
        img_tensor = clip_preprocess(pil_image).unsqueeze(0)
        with torch.no_grad():
            feats = clip_model.encode_image(img_tensor)
        return feats / feats.norm(dim=-1, keepdim=True)

def encode_texts_clip(text_list):
    """Encode a list of text strings to normalized feature vectors."""
    if use_hf_clip:
        inputs = clip_tokenizer(text=text_list, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            feats = clip_model.get_text_features(**inputs)
        return feats / feats.norm(dim=-1, keepdim=True)
    else:
        tokens = clip_tokenizer(text_list)
        with torch.no_grad():
            feats = clip_model.encode_text(tokens)
        return feats / feats.norm(dim=-1, keepdim=True)

class SimilarityReq(BaseModel):
    anchor_path: str
    catalog_path: str

class ZeroShotReq(BaseModel):
    image_path: str

class PairItem(BaseModel):
    key: str
    a: str
    b: str

class BinaryBatchReq(BaseModel):
    image_path: str
    pairs: List[PairItem]

class ImageReq(BaseModel):
    image_path: str

class PhashReq(BaseModel):
    anchor_path: str
    catalog_path: str

@app.post("/clip/similarity")
def clip_similarity(req: SimilarityReq):
    try:
        anchor_img = Image.open(req.anchor_path).convert("RGB")
        catalog_img = Image.open(req.catalog_path).convert("RGB")

        anchor_feat = encode_image_clip(anchor_img)
        catalog_feat = encode_image_clip(catalog_img)

        similarity = (anchor_feat @ catalog_feat.T).item()
        similarity = max(0.0, min(1.0, similarity))

        return {
            "success": True,
            "similarity_score": round(similarity, 4),
            "is_match": similarity > 0.65
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/clip/zero-shot")
def clip_zero_shot(req: ZeroShotReq):
    try:
        img = Image.open(req.image_path).convert("RGB")
        image_features = encode_image_clip(img)

        result = {}
        for attr_name, labels in ZERO_SHOT_ATTRIBUTES.items():
            template = PROMPT_TEMPLATES.get(attr_name, "A photo of a garment that is {}")
            text_prompts = [template.format(label) for label in labels]
            text_features = encode_texts_clip(text_prompts)

            logits = (image_features @ text_features.T).squeeze(0) * 100.0
            probs = torch.softmax(logits, dim=0)

            best_idx = probs.argmax().item()
            best_conf = probs[best_idx].item()

            result[attr_name] = {
                "value": labels[best_idx],
                "confidence": round(best_conf, 4)
            }
        return {"success": True, "attributes": result}
    except Exception as e:
        return {"error": str(e)}

@app.post("/clip/binary-batch")
def clip_binary_batch(req: BinaryBatchReq):
    try:
        img = Image.open(req.image_path).convert("RGB")
        image_features = encode_image_clip(img)

        results = {}
        for pair in req.pairs:
            text_prompts = [
                f"A photo of a garment that is {pair.a}",
                f"A photo of a garment that is {pair.b}"
            ]
            text_features = encode_texts_clip(text_prompts)

            logits = (image_features @ text_features.T).squeeze(0) * 100.0
            probs = torch.softmax(logits, dim=0)

            conf_a = probs[0].item()
            conf_b = probs[1].item()

            if conf_a >= 0.60:
                winner = pair.a
            elif conf_b >= 0.60:
                winner = pair.b
            else:
                winner = "uncertain"

            results[pair.key] = {
                "winner": winner,
                "confidence_a": round(conf_a, 4),
                "confidence_b": round(conf_b, 4)
            }

        return {"success": True, "results": results}
    except Exception as e:
        return {"error": str(e)}

@app.post("/vit/predict")
def vit_predict(req: ImageReq):
    try:
        if vit_model is None:
            return {"error": "ViT model not loaded"}

        img = Image.open(req.image_path).convert('RGB')
        img_t = vit_transform(img).unsqueeze(0).to(vit_device)
        
        with torch.no_grad():
            logits = vit_model(img_t)
            
        result = {}
        LABEL_MAPS = vit_meta['label_maps']
        HEAD_NAMES = vit_meta.get('head_names', list(LABEL_MAPS.keys()))

        for head in HEAD_NAMES:
            probs = torch.softmax(logits[head][0], dim=0)
            conf, idx = torch.max(probs, dim=0)
            val = LABEL_MAPS[head][idx.item()]
            
            result[head] = {
                "value": val,
                "confidence": round(conf.item(), 4)
            }
            
        return result
    except Exception as e:
        return {"error": str(e)}

@app.post("/segment")
def segment(req: ImageReq):
    try:
        img = Image.open(req.image_path).convert("RGBA")
        cutout = remove(img)
        alpha = np.array(cutout.split()[-1])
        y_indices, x_indices = np.where(alpha > 128)
        
        if len(y_indices) == 0 or len(x_indices) == 0:
            return {"error": "No foreground detected"}
            
        x_min, x_max = x_indices.min(), x_indices.max()
        y_min, y_max = y_indices.min(), y_indices.max()
        
        width = x_max - x_min
        height = y_max - y_min
        
        if width == 0:
            return {"error": "Width is zero"}
            
        ratio = float(height) / float(width)
        
        if ratio < 1.2:
            mathematical_length = "Short / Hip Length"
        elif 1.2 <= ratio <= 1.5:
            mathematical_length = "Knee Length / Midi"
        else:
            mathematical_length = "Below Knee / Long"
            
        cutout_path = os.path.join(os.path.dirname(req.image_path), f"cutout_{uuid.uuid4().hex}.png")
        cutout.save(cutout_path)
            
        return {
            "success": True,
            "ratio": ratio,
            "length_category": mathematical_length,
            "cutout_path": cutout_path
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/phash")
def phash(req: PhashReq):
    try:
        hash1 = imagehash.phash(Image.open(req.anchor_path))
        hash2 = imagehash.phash(Image.open(req.catalog_path))
        
        distance = hash1 - hash2
        similarity = max(0.0, 1.0 - (distance / 64.0))
        is_match = distance <= 10
        
        return {
            "success": True,
            "phash_distance": distance,
            "similarity_score": round(similarity, 4),
            "is_match": is_match
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
