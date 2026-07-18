// Configuration for Attribute Routing between ViT and Gemini

// If the ViT returns a confidence score below this threshold, 
// the system will fall back to using Gemini's extraction for that specific attribute.
export const VIT_CONFIDENCE_THRESHOLD = 0.70;

// ─── Key Translation ───
// The ViT CLI outputs short keys ("sleeve", "neck").
// Gemini and the comparison engine use canonical keys ("sleeve_length", "neck_type").
// This map translates ViT output → canonical keys used everywhere else.
export const VIT_KEY_MAP = {
  "sleeve": "sleeve_length",
  "neck": "neck_type",
  // These two are already the same between ViT and Gemini:
  "garment_type": "garment_type",
  "overall_length": "overall_length",
};

export const ROUTING_TABLE = {
  // ─── ViT Primary Attributes ───
  // These are visually obvious features that a small CNN/ViT can easily learn.
  // Keys here MUST match Gemini's output keys (the canonical names).
  "garment_type": "ViT",
  "sleeve_length": "ViT", 
  "neck_type": "ViT",
  "overall_length": "ViT",
  
  // ─── Gemini Primary Attributes ───
  // These require open-ended reasoning, ethnic wear knowledge, or text comprehension.
  "primary_color": "Gemini",
  "secondary_color": "Gemini",
  "pattern_type": "Gemini",
  "fabric_appearance": "Gemini",
  "silhouette": "Gemini",
  "fit": "Gemini",
  "embellishment": "Gemini",
  "transparency": "Gemini",
  "hemline": "Gemini",
  "occasion_style": "Gemini",
  "motif_description": "Gemini",
  "closure_type": "Gemini",
  "structural_features": "Gemini"
};
