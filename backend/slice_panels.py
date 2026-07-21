from PIL import Image
import os
import sys

def slice_5_panel(input_path, size_string):
    try:
        img = Image.open(input_path)
    except Exception as e:
        print(f"Error opening image: {e}")
        return
        
    w, h = img.size
    panel_width = w // 5
    
    views = ["front", "back", "side", "full", "closeup"]
    out_dir = "C:/Users/vansh/.gemini/antigravity/scratch/anchor/backend/uploads/pregenerated"
    os.makedirs(out_dir, exist_ok=True)
    
    # We will use the generic 'pregenerated' hash, but wait, the system searches for
    # matches based on pHash. In `gemini.js` it scans `uploads/pregenerated` for `hash_XXL_60_front.png`.
    # It reads `hash` from the anchor.
    # To test it, the user can just use this hash if we know it.
    product_hash = "281f01f349dc" 
    
    for i, view in enumerate(views):
        left = i * panel_width
        box = (left, 0, left + panel_width, h)
        panel = img.crop(box)
        
        filename = f"{product_hash}_{size_string}_{view}.png"
        panel.save(os.path.join(out_dir, filename))
        print(f"Saved: {filename}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python slice_panels.py <image_path> <size_string (e.g., XXL_60)>")
    else:
        slice_5_panel(sys.argv[1], sys.argv[2])
