import sys
import json
import numpy as np
from PIL import Image
from rembg import remove

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input file provided"}))
        sys.exit(1)

    input_path = sys.argv[1]
    
    try:
        # Load image
        img = Image.open(input_path).convert("RGBA")
        
        # Segment with rembg
        cutout = remove(img)
        
        # Find bounding box of non-transparent pixels
        alpha = np.array(cutout.split()[-1])
        y_indices, x_indices = np.where(alpha > 128)
        
        if len(y_indices) == 0 or len(x_indices) == 0:
            print(json.dumps({"error": "No foreground detected"}))
            sys.exit(0)
            
        x_min, x_max = x_indices.min(), x_indices.max()
        y_min, y_max = y_indices.min(), y_indices.max()
        
        width = x_max - x_min
        height = y_max - y_min
        
        if width == 0:
            print(json.dumps({"error": "Width is zero"}))
            sys.exit(0)
            
        ratio = float(height) / float(width)
        
        # Same logic as before
        if ratio < 1.2:
            mathematical_length = "Short / Hip Length"
        elif 1.2 <= ratio <= 1.5:
            mathematical_length = "Knee Length / Midi"
        else:
            mathematical_length = "Below Knee / Long"
            
        print(json.dumps({
            "success": True,
            "ratio": ratio,
            "length_category": mathematical_length
        }))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
