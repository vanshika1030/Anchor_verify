import sys
import json
import random

# FAKE ViT INFERENCE SCRIPT
# This returns hardcoded dummy responses matching the expected JSON contract
# so the Node backend can be built and tested while the real model trains on Kaggle.

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing image path"}))
        sys.exit(1)

    image_path = sys.argv[1]
    
    # We randomize the confidence slightly so the Node fallback logic can be tested
    # Sometimes it will be high (> 0.70) and sometimes low (< 0.70)
    
    result = {
        "garment_type": {
            "value": "Kurti",
            "confidence": round(random.uniform(0.65, 0.95), 2)
        },
        "sleeve": {
            "value": "3/4 sleeve",
            "confidence": round(random.uniform(0.65, 0.95), 2)
        },
        "neck": {
            "value": "Round",
            "confidence": round(random.uniform(0.65, 0.95), 2)
        },
        "overall_length": {
            "value": "Knee Length",
            "confidence": round(random.uniform(0.65, 0.95), 2)
        }
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
