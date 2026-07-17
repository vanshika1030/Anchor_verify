"""
Anchor Configuration — thresholds, constants, prompt templates, and API settings.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── API Keys ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── Verification Thresholds ───────────────────────────────────────────────────
EMBEDDING_SIMILARITY_PASS = 0.70      # Above this → PASS signal
EMBEDDING_SIMILARITY_WARNING = 0.55   # Between WARNING and PASS → WARNING
EMBEDDING_SIMILARITY_FAIL = 0.55      # Below this → FAIL signal

SAM_CONFIDENCE_THRESHOLD = 0.7        # Below this → skip segmentation, use full image

# ── Attribute Classification ──────────────────────────────────────────────────
HARD_ATTRIBUTES = [
    "garment_type",
    "sleeve_type", 
    "neck_type",
    "pattern",
    "structural_features",
]

SOFT_ATTRIBUTES = [
    "silhouette",
    "overall_length",
    "fit_type",
    "primary_color",
    "secondary_colors",
]

# ── Synonym Maps (prevent false positives) ────────────────────────────────────
SYNONYM_MAP = {
    "sleeve_type": {
        "elbow": ["elbow", "elbow-length", "elbow length", "mid-arm"],
        "three_quarter": ["three-quarter", "three quarter", "3/4", "three_quarter"],
        "full": ["full", "full-length", "full length", "long", "wrist-length"],
        "short": ["short", "half", "half-sleeve"],
        "sleeveless": ["sleeveless", "no sleeves", "strapless"],
    },
    "neck_type": {
        "round": ["round", "round neck", "crew", "crew neck", "crew-neck"],
        "v_neck": ["v-neck", "v neck", "v_neck", "vneck"],
        "collar": ["collar", "collared", "polo", "spread collar", "button-down"],
        "mandarin": ["mandarin", "mandarin collar", "band", "band collar", "nehru"],
        "boat": ["boat", "boat neck", "boat-neck", "bateau"],
    },
    "fit_type": {
        "slim": ["slim", "slim fit", "slim-fit", "skinny", "fitted", "body-fit"],
        "regular": ["regular", "regular fit", "classic", "standard", "normal"],
        "relaxed": ["relaxed", "loose", "comfort", "comfort fit", "easy"],
        "oversized": ["oversized", "over-sized", "boxy", "baggy", "extra loose"],
    },
    "silhouette": {
        "straight": ["straight", "straight cut", "straight-cut", "rectangular"],
        "a_line": ["a-line", "a line", "a_line", "flared from waist"],
        "bodycon": ["bodycon", "body-con", "body con", "figure-hugging"],
        "flared": ["flared", "flare", "bell", "swing"],
    },
    "primary_color": {
        "blue_family": ["navy", "navy blue", "dark blue", "royal blue", "cobalt", "indigo", "midnight blue"],
        "green_family": ["olive", "khaki", "army green", "sage", "moss", "forest green", "hunter green"],
        "brown_family": ["tan", "brown", "golden brown", "camel", "beige", "taupe", "chocolate"],
        "red_family": ["red", "maroon", "burgundy", "wine", "crimson", "cherry", "scarlet"],
        "pink_family": ["pink", "magenta", "rose", "blush", "coral", "fuchsia", "salmon"],
        "black_family": ["black", "charcoal", "jet black", "onyx", "ebony"],
        "white_family": ["white", "off-white", "cream", "ivory", "pearl", "snow"],
        "grey_family": ["grey", "gray", "silver", "ash", "slate", "pewter"],
        "yellow_family": ["yellow", "mustard", "gold", "golden", "lemon", "amber", "ochre"],
        "purple_family": ["purple", "lavender", "violet", "plum", "mauve", "lilac"],
    },
}

# ── Color Groups (for color matching — different colors in same group = MATCH) ─
COLOR_GROUPS = SYNONYM_MAP["primary_color"]

# ── Gemini Prompts ────────────────────────────────────────────────────────────

ATTRIBUTE_EXTRACTION_PROMPT = """Analyze this garment image and extract structured attributes as JSON.
Be precise — describe ONLY what you actually see, not what you guess.
The garment may be shown from any angle. Extract attributes based on the garment's actual construction, not its appearance from this specific angle.
For example, a round neck viewed from a 3/4 angle may look wider — still classify it as round neck.

Return this exact JSON structure:
{
  "garment_type": "e.g. kurta, t-shirt, dress, shirt, saree, jacket",
  "sleeve_type": "e.g. sleeveless, short, elbow, three-quarter, full",
  "neck_type": "e.g. round, v-neck, collar, mandarin, boat, halter",
  "pattern": "e.g. solid, printed, striped, checked, floral, embroidered",
  "fabric_appearance": "e.g. cotton-like, silk-like, polyester-synthetic, denim, knit, chiffon, georgette",
  "fabric_texture_identifiable": true or false,
  "fit_type": "e.g. slim, regular, relaxed, oversized",
  "silhouette": "e.g. straight, a-line, bodycon, flared",
  "structural_features": ["list of visible features like buttons, pockets, collar, belt, embroidery, zip"],
  "primary_color": "e.g. navy blue, red, black",
  "secondary_colors": ["other visible colors"],
  "overall_length": "e.g. cropped, regular, long, maxi",
  "garment_condition": "e.g. new, worn, wrinkled, folded"
}

If multiple garments are visible, extract attributes ONLY for the primary/largest garment.
If you cannot determine an attribute, set it to null — do NOT guess."""

FABRIC_VERIFICATION_PROMPT = """Compare the fabric/material texture between these two garment images.
The seller declared the fabric as: "{declared_fabric}"

Image 1 is the ANCHOR (real product photo).
Image 2 is the CATALOG (listing image — may be AI-generated or professionally shot).

Evaluate:
1. In Image 2, can a shopper identify the fabric type? Can they tell if it's {declared_fabric} vs something else?
2. Does the fabric texture in Image 2 match Image 1?
3. Has any AI rendering made the texture too smooth/idealized/generic to identify?

Return JSON:
{{
  "anchor_fabric_appearance": "description of what the real fabric looks like",
  "catalog_fabric_appearance": "description of what the catalog fabric looks like",
  "fabric_identifiable": true or false,
  "fabric_matches_anchor": true or false,
  "fabric_matches_declared": true or false,
  "confidence": 0.0 to 1.0,
  "issue": "description of mismatch if any, null if no issue",
  "recommendation": "action to take if there's a problem, null if no issue"
}}"""

MISMATCH_LOCALIZATION_PROMPT = """I detected mismatches between a real product photo and its catalog listing image.

The specific mismatches found:
{mismatch_descriptions}

Looking at the CATALOG IMAGE (Image 1), identify WHERE each mismatch is visible.

Return a JSON array:
[
  {{
    "attribute": "the attribute name that mismatched",
    "region_description": "e.g. left sleeve area, neckline, lower hem",
    "bbox_pct": [x_min, y_min, x_max, y_max],
    "shopper_explanation": "one sentence a shopper would understand",
    "seller_fix": "one sentence suggestion for the seller"
  }}
]

bbox_pct values are percentages (0-100) of image width and height.
If you cannot identify a specific region for a mismatch, set bbox_pct to [0, 0, 100, 100] and describe the issue in region_description."""

CATALOG_GENERATION_PROMPT = """Generate a professional e-commerce catalog photograph of a model wearing the EXACT garment shown in the reference image.

CRITICAL RULES:
1. The garment MUST match the reference image exactly in:
   - Sleeve length and type
   - Neckline shape  
   - Silhouette and proportions
   - Fabric texture and pattern
   - Color
   - Fit (if oversized/loose in reference, it MUST look oversized/loose on the model)
2. Model: {height}, wearing size {size}, natural pose, front-facing
3. Setting: Clean minimal studio, soft professional lighting, white/light grey background
4. Style: Commercial fashion photography, 8K quality, well-lit, no dramatic shadows
5. Do NOT modify the garment's structure, proportions, or details in any way

Confirmed garment attributes:
- Type: {garment_type}
- Sleeve: {sleeve_type}  
- Neck: {neck_type}
- Pattern: {pattern}
- Fabric: {fabric}
- Fit: {fit_type}
- Silhouette: {silhouette}
- Color: {primary_color}"""

METADATA_GENERATION_PROMPT = """Generate a complete Myntra product listing from this garment image and confirmed attributes.

CONFIRMED ATTRIBUTES (verified by seller — treat as absolute ground truth):
{attributes_json}

RULES:
1. Description MUST align with confirmed attributes exactly. Do NOT invent features not present.
2. Include genuinely applicable trend/aesthetic tags from: dark academia, cottagecore, Y2K, coastal grandmother, old money, clean girl, quiet luxury, indie, boho, streetwear, minimalist, coquette, gothic, mob wife aesthetic
3. Include occasion tags where genuine: Pongal, Onam, Diwali, wedding guest, office wear, brunch, date night, casual, festive, party
4. Generate an SEO-optimized title (max 80 characters)
5. Fill ALL mandatory Myntra SKU fields based on confirmed attributes

Return JSON:
{{
  "title": "product title with key attributes and one trend reference",
  "description": "2-3 sentences, natural language, includes trend context where genuine",
  "trend_tags": ["applicable aesthetic/occasion tags"],
  "occasion_tags": ["applicable occasions"],
  "search_keywords": ["10-15 keywords for Myntra search discovery"],
  "sku_fields": {{
    "fabric": "from confirmed attributes",
    "pattern": "from confirmed attributes",
    "sleeve_length": "from confirmed attributes",
    "neck_type": "from confirmed attributes",
    "fit_type": "from confirmed attributes",
    "occasion": "from confirmed attributes",
    "wash_care": "from confirmed attributes",
    "garment_length": "from confirmed attributes"
  }}
}}"""
