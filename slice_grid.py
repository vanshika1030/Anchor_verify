import sys
import argparse
import os
from PIL import Image

def slice_image(input_path, content_hash, size, height, outdir):
    try:
        img = Image.open(input_path)
        w, h = img.size
        
        # Assuming horizontal grid of 5 images
        piece_w = w // 5
        views = ['front', 'back', 'side', 'closeup', 'full']
        
        os.makedirs(outdir, exist_ok=True)
        
        for i, view in enumerate(views):
            left = i * piece_w
            right = (i + 1) * piece_w
            box = (left, 0, right, h)
            piece = img.crop(box)
            
            out_filename = f"{content_hash}_{size}_{height}_{view}.png"
            out_path = os.path.join(outdir, out_filename)
            piece.save(out_path)
            
        print(f"Successfully sliced {input_path} into 5 views for {size} {height}.")
        
    except Exception as e:
        print(f"Error slicing image: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--hash', required=True)
    parser.add_argument('--size', required=True)
    parser.add_argument('--height', required=True)
    parser.add_argument('--outdir', required=True)
    
    args = parser.parse_args()
    slice_image(args.input, args.hash, args.size, args.height, args.outdir)
