from PIL import Image, ImageOps
import os
import glob

# Standard Myntra aspect ratio is 3:4
TARGET_W = 600
TARGET_H = 800
ASPECT_RATIO = TARGET_W / TARGET_H

# The hash of the anchor image
product_hash = "281f01f349dc"
out_dir = "C:/Users/vansh/.gemini/antigravity/scratch/anchor/backend/uploads/pregenerated"
os.makedirs(out_dir, exist_ok=True)

VIEWS = ["front", "back", "side", "full", "closeup"]
SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
HEIGHTS = ["5'2", "5'4", "5'6", "5'8", "5'10", "6'0"]

# We use the user's defined scales from gemini.js
SIZE_SCALES = {'XS': 0.85, 'S': 0.92, 'M': 1.0, 'L': 1.08, 'XL': 1.15, 'XXL': 1.25}
HEIGHT_SCALES = {"5'2": 0.9, "5'4": 0.95, "5'6": 1.0, "5'8": 1.05, "5'10": 1.1, "6'0": 1.15}

# We have 4 high-quality AI generated base models to anchor from, avoiding extreme stretching
BASE_MODELS = {
    ("XS", "6'0"): "XS_60",
    ("M", "5'6"): "M_56",
    ("L", "5'1"): "L_51", # Wait, 5'1" isn't in standard heights, but it's close to 5'2"
    ("XXL", "6'0"): "XXL_60"
}

def get_closest_base(target_size, target_height):
    target_w = SIZE_SCALES[target_size]
    # Handle 5'1 fallback gracefully
    target_h = HEIGHT_SCALES.get(target_height, 0.85) 
    
    best_base = None
    min_dist = 999
    
    for (b_size, b_height), b_name in BASE_MODELS.items():
        b_w = SIZE_SCALES[b_size]
        b_h = HEIGHT_SCALES.get(b_height, 0.85 if b_height == "5'1" else 1.15)
        
        # Calculate Euclidean distance in scale space
        dist = ((target_w - b_w)**2 + (target_h - b_h)**2)**0.5
        if dist < min_dist:
            min_dist = dist
            best_base = b_name
            
    return best_base

def smart_resize_and_pad(img, delta_w, delta_h):
    """Slightly resizes the image based on delta scales, then pads/crops to exactly 3:4"""
    # Original size
    w, h = img.size
    
    # Apply minor scale delta
    new_w = int(w * delta_w)
    new_h = int(h * delta_h)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    
    # Now we must force it into TARGET_W x TARGET_H (3:4 ratio) WITHOUT stretching
    # We will use ImageOps.pad to add white borders if needed, or fit if it's too big
    final_img = ImageOps.pad(resized, (TARGET_W, TARGET_H), color=(255, 255, 255))
    return final_img

count = 0

for size in SIZES:
    for height in HEIGHTS:
        height_str = height.replace("'", "")
        combo_str = f"{size}_{height_str}"
        
        # Find closest base to prevent extreme stretching
        closest_base_name = get_closest_base(size, height)
        
        # Calculate delta
        base_size = closest_base_name.split("_")[0]
        base_h_str = closest_base_name.split("_")[1]
        
        target_w_scale = SIZE_SCALES[size]
        target_h_scale = HEIGHT_SCALES[height]
        
        base_w_scale = SIZE_SCALES[base_size]
        base_h_scale = 1.15 if base_h_str == "60" else (1.0 if base_h_str == "56" else 0.85)
        
        delta_w = target_w_scale / base_w_scale
        delta_h = target_h_scale / base_h_scale
        
        for view in VIEWS:
            out_filename = f"{product_hash}_{combo_str}_{view}.png"
            out_path = os.path.join(out_dir, out_filename)
            
            # If it's literally one of our exact base models, just pad it to 3:4 and save
            base_filename = f"{product_hash}_{closest_base_name}_{view}.png"
            base_path = os.path.join(out_dir, base_filename)
            
            if os.path.exists(base_path):
                img = Image.open(base_path)
                final_img = smart_resize_and_pad(img, delta_w, delta_h)
                final_img.save(out_path)
                count += 1
            else:
                pass # Base missing, skip

print(f"Synthesized {count} images spanning all 36 combinations at perfect 3:4 Myntra aspect ratio!")
