// Configuration for Attribute Routing between ViT and Gemini

// If the ViT returns a confidence score below this threshold, 
// the system will fall back to using Gemini's extraction for that specific attribute.
export const VIT_CONFIDENCE_THRESHOLD = 0.70;

// ─── Key Translation ───
// The ViT CLI outputs the keys from the training script heads.
// Gemini and the comparison engine use canonical keys (like "fabric_appearance").
// This map translates ViT output → canonical keys used everywhere else.
export const VIT_KEY_MAP = {
  "sleeve_length": "sleeve_length",
  "neck_type": "neck_type",
  "garment_type": "garment_type",
  "overall_length": "overall_length",
  "fabric_type": "fabric_appearance",
  "primary_color": "primary_color",
};

export const ROUTING_TABLE = {
  // ─── ViT Primary Attributes ───
  // These are visually obvious features that a small CNN/ViT can easily learn.
  // Keys here MUST match Gemini's output keys (the canonical names).
  "garment_type": "ViT",
  "sleeve_length": "ViT", 
  "neck_type": "ViT",
  "overall_length": "ViT",
  "fabric_appearance": "ViT",
  "primary_color": "ViT",
  
  // ─── Gemini Primary Attributes ───
  // These require open-ended reasoning, ethnic wear knowledge, or text comprehension.
  "secondary_color": "Gemini",
  "pattern_type": "Gemini",
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
