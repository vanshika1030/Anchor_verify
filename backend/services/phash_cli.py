import sys
import json
import imagehash
from PIL import Image

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing image paths. Usage: python phash_cli.py <anchor_path> <catalog_path>"}))
        sys.exit(1)

    anchor_path = sys.argv[1]
    catalog_path = sys.argv[2]
    
    try:
        hash1 = imagehash.phash(Image.open(anchor_path))
        hash2 = imagehash.phash(Image.open(catalog_path))
        
        # Hamming distance (0 = identical, >10 = very different)
        distance = hash1 - hash2
        
        # Convert distance to a similarity score (0.0 to 1.0)
        # Max distance for 64-bit hash is 64. 
        # Typically, a distance <= 10 means the images are identical/very similar.
        similarity = max(0.0, 1.0 - (distance / 64.0))
        
        # Threshold: Distance <= 10 is considered a match
        is_match = distance <= 10
        
        print(json.dumps({
            "success": True,
            "phash_distance": distance,
            "similarity_score": round(similarity, 4),
            "is_match": is_match
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
