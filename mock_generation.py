import os
import shutil
from PIL import Image
import hashlib

def get_hash(filepath):
    with open(filepath, 'rb') as f:
        # First 10240 bytes
        data = f.read(10240)
        return hashlib.md5(data).hexdigest()[:12]

PRODUCTS = {
    'tshirt': {
        'dir': 'pregenerated/prod_tshirt',
        'front': 'front.jpeg',
        'back': 'back.jpeg',
        'side': 'front.jpeg', # use front for side if missing
        'closeup': 'closeup.jpeg',
        'full': 'front.jpeg'
    },
    'jeans': {
        'dir': 'pregenerated/prod_jeans',
        'front': 'front_jeans.jpeg',
        'back': 'back_jeans.jpeg',
        'side': 'front_jeans.jpeg',
        'closeup': 'closeup_jeans.jpeg',
        'full': 'front_jeans.jpeg'
    },
    'crop': {
        'dir': 'pregenerated/prod_crop',
        'front': 'front.jpeg',
        'back': 'back.jpeg',
        'side': 'front.jpeg',
        'closeup': 'closeup.jpeg',
        'full': 'front.jpeg'
    },
    'kurti': {
        'dir': 'pregenerated/prod_kurti',
        'front': 'front.jpeg',
        'back': 'back.jpeg',
        'side': 'front.jpeg',
        'closeup': 'closeup.jpeg',
        'full': 'front.jpeg'
    }
}

SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
HEIGHTS = ["5'2", "5'4", "5'6", "5'8", "5'10", "6'0"]

# Scale modifiers relative to Medium / 5'6"
SIZE_SCALES = {
    'XS': 0.85, 'S': 0.92, 'M': 1.0, 'L': 1.08, 'XL': 1.15, 'XXL': 1.25
}
HEIGHT_SCALES = {
    "5'2": 0.9, "5'4": 0.95, "5'6": 1.0, "5'8": 1.05, "5'10": 1.1, "6'0": 1.15
}

OUTPUT_DIR = 'uploads/pregenerated'
os.makedirs(OUTPUT_DIR, exist_ok=True)

for prod_key, prod_info in PRODUCTS.items():
    front_path = os.path.join(prod_info['dir'], prod_info['front'])
    if not os.path.exists(front_path):
        continue
    
    content_hash = get_hash(front_path)
    print(f"Processing {prod_key} (Hash: {content_hash})")

    for view, filename in prod_info.items():
        if view == 'dir': continue
        
        src_path = os.path.join(prod_info['dir'], filename)
        if not os.path.exists(src_path):
            continue
            
        try:
            img = Image.open(src_path)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Base width and height
            base_w, base_h = img.size
            
            for size in SIZES:
                for height in HEIGHTS:
                    size_hash = f"{size}_{height}"
                    out_filename = f"{content_hash}_{size_hash}_{view}.png"
                    out_path = os.path.join(OUTPUT_DIR, out_filename)
                    
                    if os.path.exists(out_path):
                        continue
                        
                    # Calculate new size to simulate fitting
                    # Larger sizes -> wider garment
                    # Taller heights -> longer garment (or smaller relative to height)
                    
                    w_scale = SIZE_SCALES[size]
                    h_scale = HEIGHT_SCALES[height]
                    
                    new_w = int(base_w * w_scale)
                    new_h = int(base_h * h_scale)
                    
                    resized = img.resize((new_w, new_h), Image.LANCZOS)
                    
                    # Create a standard canvas (e.g., 600x800)
                    canvas_w, canvas_h = 600, 800
                    canvas = Image.new('RGB', (canvas_w, canvas_h), (248, 248, 248))
                    
                    # Optional: Add a light grey border to simulate "studio card"
                    from PIL import ImageDraw
                    draw = ImageDraw.Draw(canvas)
                    draw.rectangle([4, 4, canvas_w-4, canvas_h-4], outline=(220, 220, 220), width=2)
                    
                    # Center the garment on the canvas
                    # But if the garment is taller than the canvas, scale it down to fit
                    if new_w > canvas_w - 40 or new_h > canvas_h - 40:
                        fit_ratio = min((canvas_w - 40) / new_w, (canvas_h - 40) / new_h)
                        new_w = int(new_w * fit_ratio)
                        new_h = int(new_h * fit_ratio)
                        resized = resized.resize((new_w, new_h), Image.LANCZOS)
                        
                    x = (canvas_w - new_w) // 2
                    y = (canvas_h - new_h) // 2
                    
                    canvas.paste(resized, (x, y), resized)
                    canvas.save(out_path, 'PNG')
                    
        except Exception as e:
            print(f"Error processing {src_path}: {e}")

print("✅ Mock generation completed successfully!")
