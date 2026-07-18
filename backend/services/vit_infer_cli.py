import sys
import json
import os
import warnings

# Suppress warnings that might corrupt JSON output
warnings.filterwarnings("ignore")

def print_error(msg):
    print(json.dumps({"error": msg}))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print_error("Missing image path")
        
    image_path = sys.argv[1]
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    metadata_path = os.path.join(script_dir, 'model_metadata.json')
    weights_path = os.path.join(script_dir, 'model_best.safetensors')
    
    if not os.path.exists(metadata_path):
        print_error(f"Missing {metadata_path}. Please place it in {script_dir}")
    if not os.path.exists(weights_path):
        print_error(f"Missing {weights_path}. Please place it in {script_dir}")
        
    try:
        import torch
        import torch.nn as nn
        from torchvision import transforms
        from PIL import Image
        import timm
        from safetensors.torch import load_file
        
        with open(metadata_path, 'r') as f:
            meta = json.load(f)
            
        LABEL_MAPS = meta['label_maps']
        HEAD_NAMES = meta.get('head_names', list(LABEL_MAPS.keys()))
        
        class MultiHeadViT(nn.Module):
            def __init__(self):
                super().__init__()
                self.backbone = timm.create_model(meta.get('model_name', 'vit_base_patch16_224'), pretrained=False)
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
                
        # Load model on CPU for inference since we don't know if the web server has a GPU
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = MultiHeadViT()
        model.load_state_dict(load_file(weights_path, device="cpu"))
        model.to(device)
        model.eval()
        
        img_size = meta.get('input_size', 224)
        tf = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(meta.get('normalize_mean', [0.485, 0.456, 0.406]), 
                                 meta.get('normalize_std', [0.229, 0.224, 0.225])),
        ])
        
        try:
            img = Image.open(image_path).convert('RGB')
        except Exception as e:
            print_error(f"Failed to open image {image_path}: {str(e)}")
            
        img_t = tf(img).unsqueeze(0).to(device)
        
        with torch.no_grad():
            logits = model(img_t)
            
        result = {}
        for head in HEAD_NAMES:
            probs = torch.softmax(logits[head][0], dim=0)
            conf, idx = torch.max(probs, dim=0)
            val = LABEL_MAPS[head][idx.item()]
            
            result[head] = {
                "value": val,
                "confidence": round(conf.item(), 4)
            }
            
        print(json.dumps(result))
        
    except Exception as e:
        print_error(str(e))

if __name__ == "__main__":
    main()
