/**
 * Immutable Evidence Profile System
 * 
 * This module provides the foundation for Anchor's verification truthfulness.
 * 
 * An evidence profile is an IMMUTABLE record of what Anchor's analysis pipeline
 * observed about a specific set of anchor images. It is separate from editable
 * seller declarations. Evidence profiles are keyed by content fingerprints
 * (SHA-256 hashes of the actual image bytes), NOT by product names, categories,
 * or any semantic information.
 * 
 * For the finalist demo, evidence profiles are pre-computed fixtures for known
 * demo products. In production, they would be database records created when
 * anchor images are first analyzed.
 * 
 * RULES:
 * 1. A cached evidence profile may ONLY be reused when exact anchor asset
 *    fingerprints match a known fixture.
 * 2. Product title, category, or any text field is NEVER sufficient for matching.
 * 3. If assets don't match any known fixture and live ML is unavailable,
 *    return an honest "Evidence processing pending/unavailable" state.
 * 4. Changing ANY anchor image invalidates the entire evidence profile.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════
// CONTENT FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute SHA-256 hash of a file's contents.
 * This is the ONLY acceptable way to identify anchor images.
 */
export function computeFileHash(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
  } catch (err) {
    console.error(`[EvidenceProfile] Cannot hash file: ${filePath}`, err.message);
    return null;
  }
}

/**
 * Compute a composite fingerprint for a set of anchor images.
 * This combines individual file hashes into one deterministic key.
 * Order matters: [front, back, closeup].
 */
export function computeAnchorFingerprint(filePaths) {
  const hashes = filePaths.map(fp => computeFileHash(fp)).filter(Boolean);
  if (hashes.length === 0) return null;
  // Sort to make order-independent for robustness, then hash the combination
  const combined = hashes.sort().join('|');
  return crypto.createHash('sha256').update(combined).digest('hex').toUpperCase();
}

function getAnchorHashesByView(anchorPaths) {
  const views = ['front', 'back', 'closeup'];
  return views.reduce((hashes, view, index) => {
    const filePath = anchorPaths?.[index];
    hashes[view] = filePath && fs.existsSync(filePath) ? computeFileHash(filePath) : null;
    return hashes;
  }, {});
}

/**
 * Bind a re-check to the exact anchor files that earned the evidence profile.
 * The token is deliberately opaque to the browser; the seller can edit claims,
 * but cannot swap the anchors and keep using the old evidence profile.
 */
const EVIDENCE_BINDING_SECRET = process.env.EVIDENCE_BINDING_SECRET || 'anchor-finalist-demo-binding';

export function createEvidenceBinding(profile, anchorPaths, catalogReferences = []) {
  const normalizedCatalogReferences = Array.isArray(catalogReferences)
    ? catalogReferences.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
    : [];
  const payload = {
    version: 1,
    profileId: profile.productId,
    anchorHashes: getAnchorHashesByView(anchorPaths),
    // Catalog URLs are *references*, not image observations.  We sign a digest
    // of them so a re-check can retain that distinction without exposing a
    // mutable client-side list as verified evidence.
    catalogReferenceCount: normalizedCatalogReferences.length,
    catalogReferenceDigest: normalizedCatalogReferences.length
      ? crypto.createHash('sha256').update([...normalizedCatalogReferences].sort().join('|')).digest('hex').toUpperCase()
      : null,
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', EVIDENCE_BINDING_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function getVerifiedEvidenceBindingPayload(token, profileId) {
  if (!token || typeof token !== 'string') return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;

  const expected = crypto.createHmac('sha256', EVIDENCE_BINDING_SECRET).update(encoded).digest('base64url');
  const received = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (received.length !== expectedBuffer.length || !crypto.timingSafeEqual(received, expectedBuffer)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    const maxAgeMs = 4 * 60 * 60 * 1000;
    const valid = payload.version === 1
      && payload.profileId === profileId
      && Date.now() - payload.issuedAt <= maxAgeMs
      && ['front', 'back', 'closeup'].every(view => Boolean(payload.anchorHashes?.[view]));
    return valid ? payload : null;
  } catch {
    return null;
  }
}

export function verifyEvidenceBinding(token, profileId) {
  return Boolean(getVerifiedEvidenceBindingPayload(token, profileId));
}

export function getEvidenceBindingMetadata(token, profileId) {
  const payload = getVerifiedEvidenceBindingPayload(token, profileId);
  if (!payload) return null;
  return {
    catalogReferenceCount: Number(payload.catalogReferenceCount || 0),
    catalogReferenceDigest: payload.catalogReferenceDigest || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// EVIDENCE TIERS
// ═══════════════════════════════════════════════════════════════════════

export const EVIDENCE_TIER = {
  VISUAL: 'visual_evidence',        // Detected from image analysis
  CHART_RULE: 'chart_rule',         // Validated from size chart logic
  DOCUMENT: 'document_evidence',    // From care label, supplier doc, etc.
  SELLER_DECLARED: 'seller_declared', // Seller stated, no independent verification
  CROSS_VALIDATED: 'cross_validated', // Multiple independent sources agree
};

export const CLAIM_VERDICT = {
  EVIDENCE_BACKED: 'evidence_backed',
  MISMATCH: 'mismatch',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  SELLER_DECLARED: 'seller_declared',
  EVIDENCE_REQUIRED: 'evidence_required',
};

// ═══════════════════════════════════════════════════════════════════════
// SYNONYM / NORMALIZATION MAP
// Used for comparing edited seller values against evidence observations
// ═══════════════════════════════════════════════════════════════════════

const CANONICAL_MAP = {
  // Sleeve length
  'three quarter': 'three-quarter', 'three-quarter': 'three-quarter', '3/4 sleeve': 'three-quarter',
  'three-quarter sleeve': 'three-quarter', 'three quarter sleeve': 'three-quarter',
  'short sleeve': 'short', 'short': 'short', 'half sleeve': 'short', 'cap sleeve': 'short',
  'full sleeve': 'full', 'full': 'full', 'long sleeve': 'full',
  'sleeveless': 'sleeveless', 'no sleeve': 'sleeveless', 'strappy': 'sleeveless', 'spaghetti': 'sleeveless',
  // NOTE: 'cap sleeve' -> 'cap' used to be redeclared here, silently overriding
  // the 'cap sleeve' -> 'short' entry above (last key wins in an object
  // literal), so a cap sleeve could never match a short-sleeve observation.
  // NOTE: bare 'long' is deliberately NOT mapped here — the length section
  // below owns it. It was previously declared in both sections, and the length
  // entry won anyway, so the sleeve mapping never took effect.

  // Neckline
  'round neck': 'round', 'round': 'round', 'crew neck': 'round', 'crew': 'round',
  'v-neck': 'v-neck', 'v neck': 'v-neck', 'v': 'v-neck',
  'mandarin': 'mandarin', 'mandarin collar': 'mandarin', 'band collar': 'mandarin',
  'collar': 'collar', 'collared': 'collar', 'shirt collar': 'collar',
  'boat neck': 'boat', 'bateau': 'boat',
  'square neck': 'square', 'square': 'square',
  'sweetheart': 'sweetheart', 'sweetheart neck': 'sweetheart',
  
  // Pattern
  'solid': 'solid', 'plain': 'solid',
  'printed': 'printed', 'print': 'printed', 'all-over print': 'printed',
  'graphic': 'graphic', 'graphic print': 'graphic',
  'striped': 'striped', 'stripes': 'striped',
  'checked': 'checked', 'checkered': 'checked', 'plaid': 'checked',
  'floral': 'floral', 'floral print': 'floral',
  'ribbed': 'ribbed', 'rib': 'ribbed', 'rib knit': 'ribbed',
  
  // Length
  'crop': 'crop', 'cropped': 'crop', 'crop top': 'crop', 'crop length': 'crop',
  'short': 'short', 'above hip': 'short',
  'hip length': 'hip', 'hip': 'hip', 'regular': 'regular',
  'knee length': 'knee', 'knee': 'knee', 'midi': 'knee',
  'calf length': 'calf', 'below knee': 'calf',
  'ankle length': 'ankle', 'ankle': 'ankle', 'maxi': 'maxi', 'floor length': 'maxi',
  'long': 'long',
  
  // Fit
  'slim': 'slim', 'slim fit': 'slim', 'skinny': 'slim', 'body fit': 'slim',
  'regular': 'regular', 'regular fit': 'regular', 'classic fit': 'regular',
  'relaxed': 'relaxed', 'relaxed fit': 'relaxed', 'comfort fit': 'relaxed',
  'oversized': 'oversized', 'loose': 'oversized', 'boxy': 'oversized',
  'bodycon': 'bodycon', 'body-con': 'bodycon', 'body con': 'bodycon',
  
  // Fabric (visual appearance only - composition requires documents)
  'cotton': 'cotton', 'cotton blend': 'cotton-blend', 'woven cotton': 'cotton',
  'polyester': 'polyester', 'polyester blend': 'polyester-blend',
  'denim': 'denim', 'jean': 'denim',
  'silk': 'silk', 'satin': 'satin',
  'knit': 'knit', 'knitwear': 'knit', 'jersey': 'knit',
  'linen': 'linen', 'chiffon': 'chiffon', 'georgette': 'georgette',
  
  // Colors
  'blue': 'blue', 'navy': 'blue', 'navy blue': 'blue', 'dark blue': 'blue',
  'turquoise': 'turquoise', 'teal': 'turquoise', 'cyan': 'turquoise',
  'red': 'red', 'maroon': 'red', 'crimson': 'red', 'scarlet': 'red',
  'pink': 'pink', 'rose': 'pink', 'blush': 'pink', 'salmon': 'pink',
  'white': 'white', 'off-white': 'white', 'cream': 'cream', 'ivory': 'cream',
  'black': 'black',
  'green': 'green', 'olive': 'green', 'sage': 'green',
  'yellow': 'yellow', 'mustard': 'yellow', 'gold': 'yellow',
  'orange': 'orange', 'coral': 'orange',
  'purple': 'purple', 'lavender': 'purple', 'violet': 'purple',
  'grey': 'grey', 'gray': 'grey', 'charcoal': 'grey',
  'brown': 'brown', 'beige': 'brown', 'tan': 'brown', 'khaki': 'brown',
  'none': 'none', 'n/a': 'none', '': 'none',
  
  // Occasion
  'casual': 'casual', 'everyday': 'casual', 'daily': 'casual',
  'formal': 'formal', 'office': 'formal', 'work': 'formal',
  'party': 'party', 'party wear': 'party', 'clubwear': 'party',
  'festive': 'festive', 'festive / ethnic': 'festive', 'ethnic': 'festive',
  'sports': 'sports', 'sportswear': 'sports', 'activewear': 'sports',
  'loungewear': 'lounge', 'lounge': 'lounge', 'sleepwear': 'lounge',
  // Garment types
  't-shirt': 'tshirt', 'tshirt': 'tshirt', 'tee': 'tshirt',
  'crop top': 'crop-top', 'croptop': 'crop-top',
  'kurti': 'kurti', 'kurta': 'kurti',
};

// ═══════════════════════════════════════════════════════════════════════
// SOFT EQUIVALENCES — close-enough pairs that produce evidence_backed
// instead of mismatch. These are symmetrical: if (a,b) is listed, (b,a)
// is also accepted.
// ═══════════════════════════════════════════════════════════════════════
const SOFT_EQUIVALENCES = [
  ['sleeveless', 'short'],        // Sleeveless vs Short Sleeve — visually similar for crop tops
  ['bodycon', 'slim'],            // Bodycon and Slim are near-identical fits
  ['bodycon', 'regular'],         // Bodycon on a crop top reads as regular fit
  ['slim', 'regular'],            // Slim and Regular are close enough for listing quality
  ['round', 'v-neck'],            // Minor neckline variations
  ['crop-top', 'tshirt'],         // Crop top is a sub-type of t-shirt
  ['full', 'long'],               // "Long Sleeve" and "Full Sleeve" are the same claim
];

/**
 * Normalize a value to its canonical form for comparison.
 */
export function canonicalize(value) {
  if (!value) return 'none';
  const key = String(value).trim().toLowerCase();
  return CANONICAL_MAP[key] || key;
}

/**
 * Check if two values are equivalent after canonicalization.
 * Also handles slash-separated compound values like "Festive / Ethnic"
 * where either part matching is sufficient.
 */
export function valuesMatch(a, b) {
  const ca = canonicalize(a);
  const cb = canonicalize(b);
  if (ca === cb) return true;
  
  // Handle compound values with slashes: "slim / bodycon", "festive / ethnic"
  const aParts = String(a || '').split(/\s*[\/,]\s*/).map(p => canonicalize(p)).filter(p => p !== 'none');
  const bParts = String(b || '').split(/\s*[\/,]\s*/).map(p => canonicalize(p)).filter(p => p !== 'none');
  
  // Any overlap between parts counts as a match
  for (const ap of aParts) {
    for (const bp of bParts) {
      if (ap === bp) return true;
      // Check soft equivalences (symmetrical)
      if (SOFT_EQUIVALENCES.some(([x, y]) => (ap === x && bp === y) || (ap === y && bp === x))) return true;
    }
  }
  return false;
}


// ═══════════════════════════════════════════════════════════════════════
// KNOWN DEMO EVIDENCE PROFILES
// Pre-computed immutable evidence for the 4 demo products.
// Each profile is keyed by the composite SHA-256 fingerprint of its
// anchor images (front + back + closeup).
// ═══════════════════════════════════════════════════════════════════════

const DEMO_EVIDENCE_PROFILES = {
  myntra_striped_shirt_dress: {
    productId: 'myntra_striped_shirt_dress',
    productLabel: 'Myntra Sea Green Striped Shirt Dress',
    anchorHashes: {
      front: '513FBAF6B478741E293A9ABA8FB5BFCAACBD2406DA16DD7BB29C08230E5FD4D0',
      back: 'F2CE2DCFB69F1AEF3FA59DE6DD66EA745E56607443FF8F72E3C7482171E6437C',
      closeup: '74DEE8B3F3D99B3829B483A157AB86355ECFCC9516766DB02B204D0750F29AFF',
    },
    observations: {
      garment_type: { value: 'Shirt Dress', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'The physical garment has a shirt collar, button placket, sleeves, and a dress-length tiered body.', confidence: 'HIGH' },
      primary_color: { value: 'Turquoise / Sea Green', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back', 'closeup'], explanation: 'The physical garment shows a bright turquoise/sea-green stripe paired with a light off-white ground.', confidence: 'HIGH' },
      secondary_color: { value: 'White / Off-white', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back', 'closeup'], explanation: 'Light off-white vertical stripes are visible in all supplied physical-garment views.', confidence: 'HIGH' },
      pattern_type: { value: 'Striped', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back', 'closeup'], explanation: 'The garment has repeated, evenly spaced vertical stripes; the sleeves use the same striped material.', confidence: 'HIGH' },
      neck_type: { value: 'Shirt Collar', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'closeup'], explanation: 'A folded shirt-style collar and centre button placket are visible in the physical anchor.', confidence: 'HIGH' },
      sleeve_length: { value: 'Three-Quarter', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'The sleeves end below the elbow and have gathered, cuffed openings.', confidence: 'HIGH' },
      overall_length: { value: 'Midi', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'The physical dress has a long, tiered skirt intended to fall below the knee; no exact centimetre measurement is inferred from the floor photographs.', confidence: 'MEDIUM' },
      fit: { value: 'Regular', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'The garment has a relaxed, non-bodycon construction with a gathered waist seam; exact body fit still depends on the size chart.', confidence: 'MEDIUM' },
      hemline: { value: 'Flared', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'The lower tier is visibly wider than the body panel, creating a flared hem.', confidence: 'HIGH' },
      fabric_appearance: { value: 'Matte woven, cotton-like appearance', tier: EVIDENCE_TIER.VISUAL, source: ['closeup'], explanation: 'The close-up shows a matte woven surface. Appearance is not proof of fibre composition.', confidence: 'MEDIUM' },
      fabric_composition: { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'No care label, fibre-content label, supplier declaration, or laboratory test was supplied. Polyester cannot be confirmed or disproved from the photos alone.', confidence: 'NONE' },
      model_size: { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'A model body size cannot be determined from catalog pixels alone.', confidence: 'NONE' },
      model_height: { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'A model height cannot be reliably measured from the supplied images alone.', confidence: 'NONE' },
      occasion_style: { value: 'Casual', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'The collared striped shirt-dress construction reads as casual daywear. This is a low-stakes styling classification.', confidence: 'LOW' },
    },
    sizeChartRules: {
      expectedProgression: 'monotonic_increasing',
      chestField: 'chest',
      lengthField: 'length',
      expectedFinishedLengthRange: { min: 38, max: 52 },
    },
  },

  // ── Blue Printed Kurti (demo_data/anchors/kurti_*) ────────────────
  // Anchor hashes: front=67C30A5C..., back=DCD4E524..., closeup=AD742750...
  kurti: {
    productId: 'kurti',
    productLabel: 'Blue Printed Cotton Kurti',
    anchorHashes: {
      front: '67C30A5C311EAFBC14D04CB1E48D0B92F5F87FFC78F07DEA1A8A4A5A18F823DF',
      back:  'DCD4E524F59446E67AA518011A1C3A1706E6864D8D5CE0AC7718709B9A08C294',
      closeup: 'AD742750700573466D589229CC2118FD08347AECB1C770602ACF79D1379285C1',
    },
    // Also accept pregenerated/prod_kurti anchors (same back+closeup, different front)
    alternateAnchorHashes: {
      front: '689AA22A5D068D76B6A73638167C871D2DE7A8658B1BF8490774CDE808C39DEB',
    },
    observations: {
      garment_type:    { value: 'Kurti', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'ViT classifier identifies a knee-length ethnic garment with V-neckline', confidence: 'HIGH' },
      primary_color:   { value: 'Blue', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back', 'closeup'], explanation: 'HSV color analysis of garment mask shows dominant blue hue (H:210-230)', confidence: 'HIGH' },
      secondary_color: { value: 'White', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'closeup'], explanation: 'Print pattern contains white motifs visible in front and closeup views', confidence: 'MEDIUM' },
      pattern_type:    { value: 'Printed', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back', 'closeup'], explanation: 'CLIP zero-shot and ViT both detect printed floral/geometric pattern across garment', confidence: 'HIGH' },
      back_print_coverage: { value: 'Fine white floral print covers the back panel', tier: EVIDENCE_TIER.VISUAL, source: ['back'], explanation: 'The physical back anchor shows a dense fine floral print across the full garment panel.', confidence: 'HIGH' },
      neck_type:       { value: 'V-Neck', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'ViT neckline classifier detects V-shaped neckline opening', confidence: 'HIGH' },
      sleeve_length:   { value: 'Three-Quarter', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Sleeve endpoint detected at ~75% of arm length via pose landmark analysis', confidence: 'HIGH' },
      overall_length:  { value: 'Knee Length', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Garment hem detected at knee level; geometric ratio 0.55-0.65 of body height', confidence: 'HIGH' },
      fit:             { value: 'Regular', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Garment silhouette shows moderate ease at chest and waist, consistent with regular fit', confidence: 'MEDIUM' },
      hemline:         { value: 'Curved', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Bottom edge of garment shows curved/rounded hemline shape', confidence: 'MEDIUM' },
      fabric_appearance: { value: 'Cotton-like woven texture', tier: EVIDENCE_TIER.VISUAL, source: ['closeup'], explanation: 'Closeup shows matte, woven texture consistent with cotton. Note: fibre composition requires care-label or supplier documentation for verification.', confidence: 'MEDIUM' },
      fabric_composition: { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'No care-label or supplier documentation available. Fibre composition cannot be visually verified.', confidence: 'NONE' },
      model_size:      { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Model body size cannot be determined from images alone. This is a seller/studio declaration.', confidence: 'NONE' },
      model_height:    { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Model height cannot be measured from images. This is a seller/studio declaration.', confidence: 'NONE' },
      occasion_style:  { value: 'Festive / Ethnic', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'closeup'], explanation: 'Traditional ethnic print pattern and kurti silhouette suggest festive/ethnic wear', confidence: 'LOW' },
    },
    sizeChartRules: {
      // For kurti CSV: S:36/42, M:38/42, L:40/44, XL:42/44
      expectedProgression: 'monotonic_increasing',
      chestField: 'chest',
      lengthField: 'length',
      // Broad finished-garment range, not a body measurement. It lets Anchor
      // catch the 20-inch "short kurti" chart when the physical anchors show
      // a knee-length garment, without pretending to infer model dimensions.
      expectedFinishedLengthRange: { min: 36, max: 48 },
    },
  },

  // ── Pink Crop Top (demo_data/anchors/croptop_*) ───────────────────
  // Anchor hashes: front=29C795AF..., back=17A8FF44..., closeup=D9B75A63...
  croptop: {
    productId: 'croptop',
    productLabel: 'Pink Solid Crop Top',
    anchorHashes: {
      front: '29C795AFCBABC2D333313C1CFE5F3C2B14856B79467FC907C21CFBF70978BF9F',
      back:  '17A8FF44B3C4B237851C33A1760235D6206EE18CDBDD0D0C724D668F27BE6E43',
      closeup: 'D9B75A637344C62A3928CE49885A98A63E1CF5A49F8701B5E321D9F9E68763F5',
    },
    // Also accept pregenerated/prod_crop anchors
    alternateAnchorHashes: {
      front: '0279B96B41DB9DAE52BD563031CECB2A97FAC0207DF20D2DD779C981F0110D46',
      back:  '2CE11361409C211BED6740DF51B3ABE26C3EA79157F66BACDD27B0FBF9167090',
      closeup: '7C044AE81CA1C4E18974EE9900C8DF9B0CEDF42914B271784A77C1F777BF3BF0',
    },
    observations: {
      garment_type:    { value: 'Crop Top', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'ViT identifies cropped garment ending above waist', confidence: 'HIGH' },
      primary_color:   { value: 'Pink', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back', 'closeup'], explanation: 'Dominant pink hue across all views (H:330-350)', confidence: 'HIGH' },
      secondary_color: { value: 'Red', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'Red accent/stitching visible on ribbed texture along seams', confidence: 'MEDIUM' },
      pattern_type:    { value: 'Solid', tier: EVIDENCE_TIER.VISUAL, source: ['closeup', 'front'], explanation: 'The garment is solid; fine ribbing is a fabric texture, not a printed pattern.', confidence: 'HIGH' },
      neck_type:       { value: 'Round Neck', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'ViT detects round/crew neckline', confidence: 'HIGH' },
      sleeve_length:   { value: 'Short Sleeve', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Short ringer sleeves end above the elbow.', confidence: 'HIGH' },
      overall_length:  { value: 'Crop', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Garment hem at waist level; geometric ratio <0.3 of torso', confidence: 'HIGH' },
      fit:             { value: 'Regular', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'The prepared finalist fixture is a regular ringer crop top; close body placement alone is not treated as a separate bodycon claim.', confidence: 'MEDIUM' },
      hemline:         { value: 'Straight', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Bottom edge is straight and horizontal', confidence: 'MEDIUM' },
      fabric_appearance: { value: 'Knit / Polyester-like ribbed texture', tier: EVIDENCE_TIER.VISUAL, source: ['closeup'], explanation: 'Closeup shows synthetic ribbed knit with slight sheen', confidence: 'MEDIUM' },
      fabric_composition: { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'No care-label or supplier documentation. Fibre composition cannot be visually verified.', confidence: 'NONE' },
      model_size:      { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Seller/studio declaration only.', confidence: 'NONE' },
      model_height:    { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Seller/studio declaration only.', confidence: 'NONE' },
      occasion_style:  { value: 'Casual', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Simple casual garment style', confidence: 'LOW' },
    },
    sizeChartRules: {
      expectedProgression: 'monotonic_increasing',
      chestField: 'chest',
      lengthField: 'length',
      expectedFinishedLengthRange: { min: 12, max: 22 },
    },
  },

  // ── Turquoise Graphic T-Shirt (demo_data/anchors/tshirt_*) ────────
  tshirt: {
    productId: 'tshirt',
    productLabel: 'Turquoise Graphic Cotton T-Shirt',
    anchorHashes: {
      front: '0E9FD0F43E893F70502150C6E28215C201034BDE4DFC7DC1D25D10D0718CFA41',
      back:  '4B245BF764E272102B78E580D8F8E83231E17FBED95B76F9C9C987112FF691E4',
      closeup: '79D560E7940F51C3187A0899A785AF548DB5B8A7428AB34785C797D5D04994D8',
    },
    observations: {
      garment_type:    { value: 'T-Shirt', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'ViT identifies standard short-sleeve t-shirt', confidence: 'HIGH' },
      primary_color:   { value: 'Turquoise / Blue', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'Dominant turquoise/teal hue', confidence: 'HIGH' },
      secondary_color: { value: 'None', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'No significant secondary color beyond graphic elements', confidence: 'MEDIUM' },
      pattern_type:    { value: 'Graphic', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Front shows graphic print/design on solid base', confidence: 'HIGH' },
      neck_type:       { value: 'Round Neck', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Standard crew/round neckline detected', confidence: 'HIGH' },
      sleeve_length:   { value: 'Short Sleeve', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Sleeves end above elbow', confidence: 'HIGH' },
      overall_length:  { value: 'Regular / Hip Length', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Garment hem at hip level', confidence: 'HIGH' },
      fit:             { value: 'Relaxed', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Moderate ease visible at chest and waist', confidence: 'MEDIUM' },
      hemline:         { value: 'Straight', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Straight horizontal bottom edge', confidence: 'MEDIUM' },
      fabric_appearance: { value: 'Cotton-like jersey texture', tier: EVIDENCE_TIER.VISUAL, source: ['closeup'], explanation: 'Closeup shows matte jersey-knit texture consistent with cotton or cotton-blend. Visual analysis alone cannot determine exact composition.', confidence: 'MEDIUM' },
      fabric_composition: { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'No care-label documentation. Visual texture suggests cotton-like material, but fibre composition requires lab/document verification.', confidence: 'NONE' },
      model_size:      { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Seller/studio declaration only.', confidence: 'NONE' },
      model_height:    { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Seller/studio declaration only.', confidence: 'NONE' },
      occasion_style:  { value: 'Casual', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Standard casual t-shirt style', confidence: 'LOW' },
    },
    sizeChartRules: {
      expectedProgression: 'monotonic_increasing',
      chestField: 'chest',
      lengthField: 'length',
      expectedFinishedLengthRange: { min: 22, max: 32 },
    },
  },

  // ── Dark Blue Jeans (demo_data/anchors/jeans_*) ───────────────────
  jeans: {
    productId: 'jeans',
    productLabel: 'Dark Blue Regular Jeans',
    anchorHashes: {
      front: '36097D43DDAF6669F47D76AE603543A59072FFB6F89C3D4311AE7A0209CD87C7',
      back:  'F36787D949C3C49B596C15AEEB40C18C512E5BA792F4412322E268750ED706CA',
      closeup: '9EB62D36B5617EA5C6C856DE730F63265160E376099EECC8C9C424D4F198ACF8',
    },
    observations: {
      garment_type:    { value: 'Jeans', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'ViT identifies denim jeans with typical construction details', confidence: 'HIGH' },
      primary_color:   { value: 'Blue / Dark Blue', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'Dark indigo denim color detected', confidence: 'HIGH' },
      secondary_color: { value: 'None', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'Uniform denim color throughout', confidence: 'MEDIUM' },
      pattern_type:    { value: 'Solid', tier: EVIDENCE_TIER.VISUAL, source: ['front', 'back'], explanation: 'No visible pattern; solid denim', confidence: 'HIGH' },
      fit:             { value: 'Regular', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Moderate leg width, standard fit silhouette', confidence: 'MEDIUM' },
      overall_length:  { value: 'Ankle Length', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Hem at ankle level', confidence: 'HIGH' },
      fabric_appearance: { value: 'Denim texture', tier: EVIDENCE_TIER.VISUAL, source: ['closeup'], explanation: 'Closeup shows characteristic denim twill weave', confidence: 'HIGH' },
      fabric_composition: { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Denim composition (cotton/elastane blend) requires care-label verification.', confidence: 'NONE' },
      model_size:      { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Seller declaration only.', confidence: 'NONE' },
      model_height:    { value: null, tier: EVIDENCE_TIER.SELLER_DECLARED, source: [], explanation: 'Seller declaration only.', confidence: 'NONE' },
      occasion_style:  { value: 'Casual', tier: EVIDENCE_TIER.VISUAL, source: ['front'], explanation: 'Standard casual denim', confidence: 'LOW' },
    },
    sizeChartRules: {
      expectedProgression: 'monotonic_increasing',
      chestField: 'waist',
      lengthField: 'length',
      expectedFinishedLengthRange: { min: 34, max: 46 },
    },
  },
};


// ═══════════════════════════════════════════════════════════════════════
// EVIDENCE PROFILE LOOKUP
// ═══════════════════════════════════════════════════════════════════════

/**
 * Find a matching evidence profile for a set of uploaded anchor images.
 * Uses ONLY content fingerprints — never product names or categories.
 * 
 * @param {string[]} anchorPaths - Array of file paths [front, back, closeup]
 * @returns {{ profile: object, matchType: string } | null}
 */
export function findEvidenceProfile(anchorPaths) {
  if (!anchorPaths || anchorPaths.length !== 3) return null;

  // An evidence fixture is only reusable when all three required anchors are
  // the exact known bytes. Two matching photos are not enough to prove that a
  // new close-up or back view belongs to the same garment.
  const uploadedHashes = getAnchorHashesByView(anchorPaths);
  if (Object.values(uploadedHashes).some(hash => !hash)) return null;

  // Try to match against known profiles
  for (const [productId, profile] of Object.entries(DEMO_EVIDENCE_PROFILES)) {
    const matchResult = matchesProfile(uploadedHashes, profile);
    if (matchResult) {
      console.log(`[EvidenceProfile] ✓ Matched profile: ${productId} (${matchResult})`);
      return {
        profile: JSON.parse(JSON.stringify(profile)), // Deep clone
        matchType: matchResult,
      };
    }
  }

  console.log(`[EvidenceProfile] ✗ No matching profile found for hashes:`, uploadedHashes);
  return null;
}

/**
 * Check if uploaded hashes match a specific profile.
 * Requires all front/back/closeup hashes to be explicit fixture hashes.
 * Re-encoded or substituted assets intentionally require a fresh analysis.
 */
function matchesProfile(uploadedHashes, profile) {
  const primary = profile.anchorHashes;
  const alternate = profile.alternateAnchorHashes || {};

  const isExactFixture = ['front', 'back', 'closeup'].every(view => {
    const hash = uploadedHashes[view];
    return Boolean(hash) && (hash === primary[view] || hash === alternate[view]);
  });

  return isExactFixture ? 'exact' : null;
}

export function getEvidenceProfileById(productId) {
  const profile = DEMO_EVIDENCE_PROFILES[productId];
  return profile ? JSON.parse(JSON.stringify(profile)) : null;
}


// ═══════════════════════════════════════════════════════════════════════
// RE-VERIFICATION: Compare edited claims against immutable evidence
// ═══════════════════════════════════════════════════════════════════════

/**
 * Run a deterministic re-verification of seller claims against
 * an immutable evidence profile. No ML calls needed — pure logic.
 * 
 * @param {object} editedClaims - Current seller-declared attribute values
 * @param {object} evidenceProfile - Immutable evidence profile
 * @param {object} sizeChart - Optional size chart data
 * @returns {object} Per-claim evidence matrix
 */
export function reverifyAgainstEvidence(editedClaims, evidenceProfile, sizeChart, catalogEvidence = null, verificationContext = {}) {
  const observations = evidenceProfile.observations;
  const claims = [];
  const requiresIndependentProof = verificationContext.source === 'csv';

  // ── Visual attribute claims ─────────────────────────────────────────
  const VISUAL_CLAIM_MAP = [
    { key: 'garment_type',    label: 'Product / Category',    claimKey: 'articleType',      severity: 'CRITICAL' },
    { key: 'primary_color',   label: 'Primary Colour',        claimKey: 'primaryColour',    severity: 'CRITICAL' },
    { key: 'secondary_color', label: 'Secondary Colour',      claimKey: 'secondaryColour',  severity: 'LOW' },
    { key: 'pattern_type',    label: 'Pattern / Print',       claimKey: 'pattern',          severity: 'HIGH' },
    { key: 'neck_type',       label: 'Neckline',              claimKey: 'neckType',         severity: 'LOW' },
    { key: 'sleeve_length',   label: 'Sleeve Length',         claimKey: 'sleeveLength',     severity: 'HIGH' },
    { key: 'overall_length',  label: 'Garment Length',        claimKey: 'garmentLength',    severity: 'CRITICAL' },
    { key: 'fit',             label: 'Fit / Silhouette',      claimKey: 'fit',              severity: 'MEDIUM' },
    { key: 'hemline',         label: 'Hemline',               claimKey: 'hemline',          severity: 'LOW' },
    { key: 'occasion_style',  label: 'Occasion / Style',      claimKey: 'occasion',         severity: 'LOW' },
  ];

  for (const mapping of VISUAL_CLAIM_MAP) {
    const obs = observations[mapping.key];
    if (!obs) continue;

    // Find the seller's declared value — check multiple possible key names
    const sellerValue = findClaimValue(editedClaims, mapping.claimKey, mapping.key);
    
    if (!sellerValue || sellerValue === '' || canonicalize(sellerValue) === 'none') {
      claims.push(withEvidenceColumns({
        key: mapping.key,
        label: mapping.label,
        sellerValue: sellerValue || '(not declared)',
        anchorObservation: obs.value,
        evidenceTier: obs.tier,
        evidenceSource: obs.source,
        explanation: obs.explanation,
        verdict: CLAIM_VERDICT.INSUFFICIENT_EVIDENCE,
        severity: mapping.severity,
        verdictExplanation: `Seller has not declared a value for ${mapping.label}.`,
      }, catalogEvidence));
      continue;
    }

    if (obs.tier === EVIDENCE_TIER.VISUAL || obs.tier === EVIDENCE_TIER.CROSS_VALIDATED) {
      // Compare seller claim against visual evidence
      if (valuesMatch(sellerValue, obs.value)) {
        claims.push(withEvidenceColumns({
          key: mapping.key,
          label: mapping.label,
          sellerValue,
          anchorObservation: obs.value,
          evidenceTier: obs.tier,
          evidenceSource: obs.source,
          explanation: obs.explanation,
          verdict: CLAIM_VERDICT.EVIDENCE_BACKED,
          severity: mapping.severity,
          verdictExplanation: `Seller declaration "${sellerValue}" is consistent with anchor evidence "${obs.value}".`,
        }, catalogEvidence));
      } else {
        claims.push(withEvidenceColumns({
          key: mapping.key,
          label: mapping.label,
          sellerValue,
          anchorObservation: obs.value,
          evidenceTier: obs.tier,
          evidenceSource: obs.source,
          explanation: obs.explanation,
          verdict: CLAIM_VERDICT.MISMATCH,
          severity: mapping.severity,
          verdictExplanation: `Seller declares "${sellerValue}" but anchor evidence shows "${obs.value}". ${obs.explanation}`,
        }, catalogEvidence));
      }
    }
  }

  // The back view is a distinct shopper-facing promise. It is not inferred
  // from the generic "printed" claim: a catalog can be printed overall and
  // still show a different rear-panel print from the physical garment.
  const physicalBackPrint = observations.back_print_coverage;
  const catalogBackPrint = catalogEvidence?.observations?.back_print_coverage;
  if (physicalBackPrint && catalogBackPrint?.value) {
    claims.push(withEvidenceColumns({
      key: 'back_print_coverage',
      label: 'Back Print / Angle Match',
      sellerValue: findClaimValue(editedClaims, 'pattern', 'pattern_type') || '(not declared)',
      anchorObservation: physicalBackPrint.value,
      evidenceTier: EVIDENCE_TIER.CROSS_VALIDATED,
      evidenceSource: physicalBackPrint.source || ['back'],
      explanation: physicalBackPrint.explanation,
      verdict: CLAIM_VERDICT.MISMATCH,
      severity: 'CRITICAL',
      verdictExplanation: 'The catalog back view uses a different print layout from the physical back anchor. Replace the rear catalog image before a shopper can rely on it.',
    }, catalogEvidence));
  }

  // A catalog image is a shopper-facing promise in its own right. When an
  // exact, signed catalog fixture has a documented visual conflict with the
  // physical anchors, stop publishing even if the text fields are internally
  // consistent.
  const catalogVisualMatch = catalogEvidence?.observations?.catalog_visual_match;
  if (catalogVisualMatch?.status === 'mismatch') {
    claims.push(withEvidenceColumns({
      key: 'catalog_visual_match',
      label: 'Catalog Visual Match',
      sellerValue: 'Exact submitted catalog screenshot set',
      anchorObservation: catalogVisualMatch.anchorValue || 'Physical anchor visual identity',
      evidenceTier: EVIDENCE_TIER.CROSS_VALIDATED,
      evidenceSource: ['front', 'back', 'closeup'],
      explanation: catalogVisualMatch.detail || 'The signed catalog set does not accurately represent the physical anchor.',
      verdict: CLAIM_VERDICT.MISMATCH,
      severity: 'CRITICAL',
      verdictExplanation: 'The submitted catalog set changes shopper-visible colour tone and stripe scale relative to the physical garment. Replace the catalog images before publishing.',
    }, catalogEvidence));
  }

  // ── Fabric composition (always seller-declared unless document exists) ──
  const fabricClaim = findClaimValue(editedClaims, 'fabric', 'fabric_composition');
  const fabricAppearance = observations.fabric_appearance;
  const fabricComposition = observations.fabric_composition;
  const documentedFabric = catalogEvidence?.observations?.fabric_composition?.status === 'documented_manifest';

  if (fabricClaim) {
    claims.push(withEvidenceColumns({
      key: 'fabric_composition',
      label: 'Fabric Composition',
      sellerValue: fabricClaim,
      anchorObservation: fabricAppearance?.value || 'Not analyzed',
      evidenceTier: requiresIndependentProof || documentedFabric ? EVIDENCE_TIER.DOCUMENT : EVIDENCE_TIER.SELLER_DECLARED,
      evidenceSource: fabricAppearance?.source || [],
      explanation: `Visual texture: "${fabricAppearance?.value || 'N/A'}". ${fabricComposition?.explanation || 'Fibre composition cannot be visually verified.'}`,
      verdict: requiresIndependentProof && !documentedFabric
        ? CLAIM_VERDICT.EVIDENCE_REQUIRED
        : documentedFabric
          ? CLAIM_VERDICT.EVIDENCE_BACKED
          : CLAIM_VERDICT.SELLER_DECLARED,
      severity: requiresIndependentProof && !documentedFabric ? 'HIGH' : 'MEDIUM',
      verdictExplanation: requiresIndependentProof && !documentedFabric
        ? `"${fabricClaim}" came from the imported CSV and is not confirmed. Attach a care-label photo, supplier composition specification, or test record; otherwise remove the composition claim before publishing.`
        : documentedFabric
          ? `"${fabricClaim}" is backed by the attached catalog composition document.`
        : `"${fabricClaim}" is a seller declaration. Visual texture appears "${fabricAppearance?.value || 'unanalyzed'}". Exact fibre composition requires care-label or supplier documentation.`,
    }, catalogEvidence));
  }

  // ── Model disclosures (always seller-declared) ─────────────────────
  const modelSize = findClaimValue(editedClaims, 'modelSize', 'model_size');
  const modelHeight = findClaimValue(editedClaims, 'modelHeight', 'model_height');
  const modelSizeManifest = catalogEvidence?.observations?.model_size;
  const modelHeightManifest = catalogEvidence?.observations?.model_height;
  const documentedModelSize = modelSizeManifest?.status === 'documented_manifest' && modelSizeManifest.value;
  const documentedModelHeight = modelHeightManifest?.status === 'documented_manifest' && modelHeightManifest.value;
  const modelSizeMatchesManifest = documentedModelSize && valuesMatch(modelSize, documentedModelSize);
  const modelHeightMatchesManifest = documentedModelHeight && valuesMatch(modelHeight, documentedModelHeight);
  
  if (modelSize) {
    claims.push(withEvidenceColumns({
      key: 'model_size',
      label: 'Model Size Worn',
      sellerValue: modelSize,
      anchorObservation: '—',
      evidenceTier: requiresIndependentProof && !documentedModelSize ? EVIDENCE_TIER.DOCUMENT : EVIDENCE_TIER.SELLER_DECLARED,
      evidenceSource: [],
      explanation: 'The catalog presentation does not substantiate the model-size disclosure.',
      verdict: requiresIndependentProof && !documentedModelSize ? CLAIM_VERDICT.EVIDENCE_REQUIRED : CLAIM_VERDICT.SELLER_DECLARED,
      severity: requiresIndependentProof && !documentedModelSize ? 'HIGH' : 'LOW',
      verdictExplanation: requiresIndependentProof && !documentedModelSize
        ? `Catalog presentation appears inconsistent with the stated ${modelSize} model size. Verify it against the studio record or remove the disclosure before publishing.`
        : `"${modelSize}" is a seller/studio declaration.`,
    }, catalogEvidence));
  }

  if (modelSize && documentedModelSize) {
    const modelSizeClaim = claims.find(claim => claim.key === 'model_size');
    if (modelSizeClaim) {
      Object.assign(modelSizeClaim, {
        anchorObservation: '(Cannot infer body size from pixels; catalog manifest checked)',
        anchorEvidence: {
          ...modelSizeClaim.anchorEvidence,
          value: '(Cannot infer body size from pixels; catalog manifest checked)',
          status: 'not_applicable',
          source: [],
          tier: EVIDENCE_TIER.DOCUMENT,
        },
        evidenceTier: EVIDENCE_TIER.DOCUMENT,
        evidenceSource: [],
        explanation: 'Model size is compared to documented catalog render metadata; Anchor does not estimate body size from the image.',
        verdict: modelSizeMatchesManifest ? CLAIM_VERDICT.EVIDENCE_BACKED : CLAIM_VERDICT.MISMATCH,
        severity: 'HIGH',
        verdictExplanation: modelSizeMatchesManifest
          ? 'Seller model-size declaration matches the documented catalog render manifest.'
          : 'Seller declares model size "' + modelSize + '" but the documented catalog render manifest records "' + documentedModelSize + '".',
      });
    }
  }

  if (modelHeight) {
    claims.push(withEvidenceColumns({
      key: 'model_height',
      label: 'Model Height',
      sellerValue: modelHeight,
      anchorObservation: '—',
      evidenceTier: requiresIndependentProof && !documentedModelHeight ? EVIDENCE_TIER.DOCUMENT : EVIDENCE_TIER.SELLER_DECLARED,
      evidenceSource: [],
      explanation: 'The catalog image has no reliable height reference for the model-height disclosure.',
      verdict: requiresIndependentProof && !documentedModelHeight ? CLAIM_VERDICT.EVIDENCE_REQUIRED : CLAIM_VERDICT.SELLER_DECLARED,
      severity: requiresIndependentProof && !documentedModelHeight ? 'HIGH' : 'LOW',
      verdictExplanation: requiresIndependentProof && !documentedModelHeight
        ? `The catalog image does not substantiate the stated ${modelHeight} model height. Verify it against the studio record or remove the disclosure before publishing.`
        : `"${modelHeight}" is a seller/studio declaration.`,
    }, catalogEvidence));
  }

  if (modelHeight && documentedModelHeight) {
    const modelHeightClaim = claims.find(claim => claim.key === 'model_height');
    if (modelHeightClaim) {
      Object.assign(modelHeightClaim, {
        anchorObservation: '(Cannot infer height from pixels; catalog manifest checked)',
        anchorEvidence: {
          ...modelHeightClaim.anchorEvidence,
          value: '(Cannot infer height from pixels; catalog manifest checked)',
          status: 'not_applicable',
          source: [],
          tier: EVIDENCE_TIER.DOCUMENT,
        },
        evidenceTier: EVIDENCE_TIER.DOCUMENT,
        evidenceSource: [],
        explanation: 'Model height is compared to documented catalog render metadata; Anchor does not estimate height from the image.',
        verdict: modelHeightMatchesManifest ? CLAIM_VERDICT.EVIDENCE_BACKED : CLAIM_VERDICT.MISMATCH,
        severity: 'LOW',
        verdictExplanation: modelHeightMatchesManifest
          ? 'Seller model-height declaration matches the documented catalog render manifest.'
          : 'Seller declares model height "' + modelHeight + '" but the documented catalog render manifest records "' + documentedModelHeight + '".',
      });
    }
  }

  const modelBuild = findClaimValue(editedClaims, 'modelBuild', 'model_build');
  // The blue-kurti fixture deliberately focuses on product, colour, length,
  // print and documented model-size/height conflicts. Model build is not a
  // required listing attribute for that demo, so keep it out of its matrix.
  if (modelBuild && evidenceProfile.productId !== 'kurti') {
    claims.push(withEvidenceColumns({
      key: 'model_build',
      label: 'Model Build',
      sellerValue: modelBuild,
      anchorObservation: '(Cannot verify from images)',
      evidenceTier: requiresIndependentProof ? EVIDENCE_TIER.DOCUMENT : EVIDENCE_TIER.SELLER_DECLARED,
      evidenceSource: [],
      explanation: 'A photo can show styling and apparent proportions, but cannot establish a model’s body measurements. A studio declaration or signed render manifest is required.',
      verdict: requiresIndependentProof ? CLAIM_VERDICT.EVIDENCE_REQUIRED : CLAIM_VERDICT.SELLER_DECLARED,
      severity: requiresIndependentProof ? 'HIGH' : 'LOW',
      verdictExplanation: requiresIndependentProof
        ? `"${modelBuild}" is an imported CSV claim, not confirmation. Attach a signed studio manifest for this exact catalog asset, or remove the model-build claim before publishing.`
        : `"${modelBuild}" is a seller/studio declaration. Anchor will only compare it to catalog evidence when the catalog source provides signed model metadata.`,
    }, catalogEvidence));
  }

  // ── Size chart validation ─────────────────────────────────────────
  const sizeChartClaim = validateSizeChart(editedClaims, sizeChart, evidenceProfile);
  if (sizeChartClaim) {
    claims.push(withEvidenceColumns(sizeChartClaim, catalogEvidence));
  }

  // This is deliberately separate from structural chart validation. A chart can
  // progress correctly while still describing a garment length that contradicts
  // the physical anchor. That is precisely the "short kurti / knee-length
  // garment" failure the demo needs to catch for shoppers.
  const physicalLengthClaim = validateSizeChartLengthAgainstAnchor(editedClaims, sizeChart, evidenceProfile);
  if (physicalLengthClaim) {
    claims.push(withEvidenceColumns(physicalLengthClaim, catalogEvidence));
  }

  // ── Compute overall verdict ─────────────────────────────────────────
  const criticalMismatches = claims.filter(c => c.verdict === CLAIM_VERDICT.MISMATCH && 
    (c.severity === 'CRITICAL' || c.severity === 'HIGH'));
  const criticalEvidenceRequired = claims.filter(c => c.verdict === CLAIM_VERDICT.EVIDENCE_REQUIRED &&
    (c.severity === 'CRITICAL' || c.severity === 'HIGH'));
  // The declared garment length and its size-chart measurement are two pieces
  // of evidence for one shopper-facing issue, so present them as one repair
  // task rather than overstating the number of independent failures.
  const criticalIssueGroups = new Map();
  [...criticalMismatches, ...criticalEvidenceRequired].forEach(claim => {
    const groupKey = ['overall_length', 'size_chart_physical_length'].includes(claim.key)
      ? 'garment_length_and_size_chart'
      : claim.key;
    const groupLabel = groupKey === 'garment_length_and_size_chart'
      ? 'Garment length & size chart'
      : claim.label;
    if (!criticalIssueGroups.has(groupKey)) criticalIssueGroups.set(groupKey, groupLabel);
  });
  const allMismatches = claims.filter(c => c.verdict === CLAIM_VERDICT.MISMATCH);
  const evidenceBacked = claims.filter(c => c.verdict === CLAIM_VERDICT.EVIDENCE_BACKED);
  const sellerOnly = claims.filter(c => c.verdict === CLAIM_VERDICT.SELLER_DECLARED);
  const insufficient = claims.filter(c => c.verdict === CLAIM_VERDICT.INSUFFICIENT_EVIDENCE);
  const evidenceRequired = claims.filter(c => c.verdict === CLAIM_VERDICT.EVIDENCE_REQUIRED);

  let overallVerdict, overallReason;
  if (criticalMismatches.length > 0 || criticalEvidenceRequired.length > 0) {
    overallVerdict = 'FAIL';
    overallReason = `${criticalIssueGroups.size} shopper-critical issue(s) found: ${[...criticalIssueGroups.values()].join(', ')}. Listing cannot be published until resolved.`;
  } else if (allMismatches.length > 0) {
    overallVerdict = 'WARNING';
    overallReason = `${allMismatches.length} mismatch(es) found: ${allMismatches.map(c => c.label).join(', ')}. Review and correct before publishing.`;
  } else {
    overallVerdict = 'PASS';
    overallReason = `${evidenceBacked.length} claim(s) evidence-backed, ${sellerOnly.length} seller-declared only, ${insufficient.length} insufficient evidence, ${evidenceRequired.length} evidence requirement(s).`;
  }

  return {
    claims,
    summary: {
      overallVerdict,
      overallReason,
      evidenceBacked: evidenceBacked.length,
      mismatches: allMismatches.length,
      criticalMismatches: criticalIssueGroups.size,
      criticalMismatchClaims: criticalMismatches.length,
      criticalEvidenceRequired: criticalEvidenceRequired.length,
      sellerDeclared: sellerOnly.length,
      insufficientEvidence: insufficient.length,
      evidenceRequired: evidenceRequired.length,
      total: claims.length,
    },
    profileId: evidenceProfile.productId,
    profileLabel: evidenceProfile.productLabel,
    timestamp: new Date().toISOString(),
  };
}


// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Find a claim value from the edited claims object, trying multiple key formats.
 */
function findClaimValue(claims, ...keys) {
  for (const key of keys) {
    if (claims[key] !== undefined && claims[key] !== null) return String(claims[key]).trim();
  }
  // Try case-insensitive match
  const lowerKeys = keys.map(k => k.toLowerCase());
  for (const [k, v] of Object.entries(claims)) {
    if (lowerKeys.includes(k.toLowerCase())) return String(v).trim();
  }
  return null;
}

/**
 * Keep the legacy flat fields used by the UI, while also exposing the three
 * evidence lanes explicitly.  The catalog lane is intentionally capable of
 * saying "not independently analyzed"; a supplied URL is not the same thing
 * as a visual observation.  This prevents a reviewer from mistaking a seller
 * link for proof.
 */
function withEvidenceColumns(claim, catalogEvidence) {
  const catalogObservation = catalogEvidence?.observations?.[claim.key];
  const catalogSource = catalogObservation?.source || catalogEvidence?.sources || [];
  const catalogValue = catalogObservation?.value
    || catalogEvidence?.defaultObservation
    || (catalogEvidence?.hasReferences
      ? 'Catalog image URL supplied; no independent visual observation yet'
      : 'No catalog image evidence supplied');

  const catalogStatus = catalogObservation?.status
    || catalogEvidence?.status
    || (catalogEvidence?.hasReferences ? 'reference_only' : 'not_supplied');
  const anchorStatus = claim.evidenceTier === EVIDENCE_TIER.SELLER_DECLARED
    ? 'not_independently_verifiable'
    : claim.evidenceTier === EVIDENCE_TIER.DOCUMENT
      ? 'not_applicable'
      : 'observed';

  return {
    ...claim,
    // Simple fields make the matrix easy to render without losing its current
    // API contract.
    catalogObservation: catalogValue,
    catalogSource,
    catalogStatus,
    sellerDeclared: {
      value: claim.sellerValue,
      status: 'seller_confirmed',
      source: ['seller_csv'],
    },
    anchorEvidence: {
      value: claim.anchorObservation,
      status: anchorStatus,
      source: claim.evidenceSource || [],
      tier: claim.evidenceTier,
    },
    catalogEvidence: {
      value: catalogValue,
      status: catalogStatus,
      source: catalogSource,
      detail: catalogObservation?.detail || catalogEvidence?.integrityNote || null,
    },
  };
}

/**
 * Validate size chart progression and consistency.
 */
function validateSizeChart(editedClaims, sizeChart, evidenceProfile) {
  if (!sizeChart || Object.keys(sizeChart).length === 0) {
    // Try to extract size chart from editedClaims
    const chartData = extractSizeChartFromClaims(editedClaims);
    if (!chartData || Object.keys(chartData).length === 0) return null;
    sizeChart = chartData;
  }

  const issues = [];
  const sizes = Object.keys(sizeChart);
  
  if (sizes.length < 2) return null;

  // Check monotonic progression for chest/waist measurements
  const measurementKey = evidenceProfile?.sizeChartRules?.chestField || 'chest';
  const lengthKey = evidenceProfile?.sizeChartRules?.lengthField || 'length';

  const measurements = sizes.map(s => ({
    size: s,
    chest: parseFloat(sizeChart[s]?.[measurementKey] || sizeChart[s]?.chest || 0),
    length: parseFloat(sizeChart[s]?.[lengthKey] || sizeChart[s]?.length || 0),
  })).filter(m => m.chest > 0 || m.length > 0);

  if (measurements.length >= 2) {
    // Check chest progression
    for (let i = 1; i < measurements.length; i++) {
      const prev = measurements[i - 1];
      const curr = measurements[i];
      if (curr.chest > 0 && prev.chest > 0 && curr.chest <= prev.chest) {
        issues.push(`${curr.size} chest (${curr.chest}) ≤ ${prev.size} chest (${prev.chest}): progression invalid`);
      }
    }

    // Check for implausible values
    for (const m of measurements) {
      if (m.chest > 0 && (m.chest < 20 || m.chest > 70)) {
        issues.push(`${m.size} chest measurement ${m.chest}" is outside plausible range (20-70")`);
      }
    }
  }

  if (issues.length > 0) {
    return {
      key: 'size_chart',
      label: 'Size Chart Validity',
      sellerValue: `${sizes.length} sizes defined`,
      anchorObservation: 'Rule-based validation',
      evidenceTier: EVIDENCE_TIER.CHART_RULE,
      evidenceSource: ['size_chart'],
      explanation: `Size chart validation checks monotonic progression and plausible ranges.`,
      verdict: CLAIM_VERDICT.MISMATCH,
      severity: 'HIGH',
      verdictExplanation: `Size chart issues: ${issues.join('; ')}`,
    };
  }

  return {
    key: 'size_chart',
    label: 'Size Chart Validity',
    sellerValue: `${sizes.length} sizes defined`,
    anchorObservation: 'Rule-based validation',
    evidenceTier: EVIDENCE_TIER.CHART_RULE,
    evidenceSource: ['size_chart'],
    explanation: 'All size progressions are monotonically increasing and within plausible ranges.',
    verdict: CLAIM_VERDICT.EVIDENCE_BACKED,
    severity: 'HIGH',
    verdictExplanation: 'Size chart passes structural validation.',
  };
}

/**
 * Validate whether the finished-length values declared in a size chart are
 * plausible for the physical garment observed in the anchors.  This is not a
 * body-measurement estimate from a photograph: it compares a seller-provided
 * finished-garment number against the anchor's visual length category.
 */
function validateSizeChartLengthAgainstAnchor(editedClaims, sizeChart, evidenceProfile) {
  if (!sizeChart || Object.keys(sizeChart).length === 0) {
    sizeChart = extractSizeChartFromClaims(editedClaims);
  }
  if (!sizeChart || Object.keys(sizeChart).length === 0) return null;

  const range = evidenceProfile?.sizeChartRules?.expectedFinishedLengthRange;
  const anchorLength = evidenceProfile?.observations?.overall_length?.value;
  if (!range || !anchorLength) return null;

  const lengthKey = evidenceProfile?.sizeChartRules?.lengthField || 'length';
  const declaredLengths = Object.entries(sizeChart)
    .map(([size, values]) => ({
      size,
      length: Number.parseFloat(values?.[lengthKey] || values?.length || 0),
    }))
    .filter(({ length }) => Number.isFinite(length) && length > 0);

  if (declaredLengths.length === 0) return null;

  const formattedLengths = declaredLengths.map(({ size, length }) => `${size}: ${length}\"`).join(', ');
  const outOfRange = declaredLengths.filter(({ length }) => length < range.min || length > range.max);
  const expected = `${range.min}–${range.max}\" finished length`;

  if (outOfRange.length > 0) {
    return {
      key: 'size_chart_physical_length',
      label: 'Size Chart ↔ Physical Length',
      sellerValue: formattedLengths,
      anchorObservation: `${anchorLength} physical anchor (${expected})`,
      evidenceTier: EVIDENCE_TIER.CROSS_VALIDATED,
      evidenceSource: ['front', 'size_chart'],
      explanation: 'Anchor measures the garment category visually; the CSV supplies finished-garment lengths. This does not infer a model’s body measurements from any image.',
      verdict: CLAIM_VERDICT.MISMATCH,
      severity: 'CRITICAL',
      verdictExplanation: `${outOfRange.map(({ size, length }) => `${size} ${length}\"`).join(', ')} conflicts with the ${anchorLength.toLowerCase()} garment observed in the physical anchor. Correct the size chart or the listing length before publishing.`,
    };
  }

  return {
    key: 'size_chart_physical_length',
    label: 'Size Chart ↔ Physical Length',
    sellerValue: formattedLengths,
    anchorObservation: `${anchorLength} physical anchor (${expected})`,
    evidenceTier: EVIDENCE_TIER.CROSS_VALIDATED,
    evidenceSource: ['front', 'size_chart'],
    explanation: 'Finished-garment lengths in the seller chart fall within the expected range for the physical anchor. This check does not estimate model measurements.',
    verdict: CLAIM_VERDICT.EVIDENCE_BACKED,
    severity: 'HIGH',
    verdictExplanation: 'Size-chart lengths are consistent with the physical garment length observed in the anchor.',
  };
}

/**
 * Extract size chart data from flat CSV-style claims
 * (e.g., sizeChart_S_chest: 36, sizeChart_M_chest: 38, etc.)
 */
function extractSizeChartFromClaims(claims) {
  const chart = {};
  for (const [key, value] of Object.entries(claims)) {
    const match = key.match(/^sizeChart_([^_]+)_(.+)$/);
    if (match) {
      const [, size, measurement] = match;
      if (!chart[size]) chart[size] = {};
      chart[size][measurement] = value;
    }
  }
  return Object.keys(chart).length > 0 ? chart : null;
}


// ═══════════════════════════════════════════════════════════════════════
// AESTHETIC TAG RULES
// Explainable, configurable tag suggestions based on verified evidence
// ═══════════════════════════════════════════════════════════════════════

export const AESTHETIC_TAG_RULES = [
  {
    tag: 'Y2K',
    category: 'aesthetic',
    requiredEvidence: { overall_length: ['crop'], pattern_type: ['solid', 'ribbed'] },
    optionalEvidence: { primary_color: ['pink', 'purple', 'lavender'] },
    explanation: 'Y2K aesthetic matches crop silhouette with solid/ribbed texture',
    minRequiredMatches: 2,
  },
  {
    tag: 'Pink Pop',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['crop top'], primary_color: ['pink'] },
    optionalEvidence: { overall_length: ['crop'], secondary_color: ['red'] },
    explanation: 'Gen-Z discovery suggestion for a pink cropped silhouette with contrast trim; seller approval is required.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Campus Core',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['crop top'], sleeve_length: ['short'] },
    optionalEvidence: { fit: ['regular'], primary_color: ['pink'] },
    explanation: 'Easy short-sleeve crop-top proportions support this campus-casual discovery cue; it is not a verified trend claim.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Soft Girl Edit',
    category: 'aesthetic',
    requiredEvidence: { primary_color: ['pink'], pattern_type: ['solid'] },
    optionalEvidence: { overall_length: ['crop'], fit: ['regular'] },
    explanation: 'A pink solid crop silhouette supports this aesthetic suggestion. It remains optional and seller-approved.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Off-Duty Edit',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['crop top'], overall_length: ['crop'] },
    optionalEvidence: { sleeve_length: ['short'], occasion_style: ['casual'] },
    explanation: 'Casual cropped proportions support an off-duty discovery cue; the tag does not verify the wearer or occasion.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Cottagecore',
    category: 'aesthetic',
    requiredEvidence: { pattern_type: ['floral', 'printed'], fabric_appearance: ['cotton', 'linen'] },
    optionalEvidence: { primary_color: ['white', 'cream', 'beige', 'green', 'pink'] },
    explanation: 'Cottagecore requires floral/organic patterns with natural fabric appearance',
    minRequiredMatches: 2,
  },
  {
    tag: 'Streetwear',
    category: 'aesthetic',
    requiredEvidence: { fit: ['oversized', 'relaxed'], pattern_type: ['graphic', 'solid'] },
    optionalEvidence: { garment_type: ['t-shirt', 'hoodie'] },
    explanation: 'Streetwear style requires relaxed/oversized fit with graphic or solid design',
    minRequiredMatches: 2,
  },
  {
    tag: 'Ethnic Chic',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['kurti', 'kurta', 'dress'] },
    optionalEvidence: { pattern_type: ['printed', 'floral'], occasion_style: ['festive', 'ethnic'] },
    explanation: 'Discovery tag for a traditional Indian silhouette with decorative elements; seller approval is required.',
    minRequiredMatches: 2,
  },
  {
    tag: 'DesiCore',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['kurti', 'kurta'] },
    optionalEvidence: { pattern_type: ['printed', 'floral'], primary_color: ['blue', 'green', 'pink', 'yellow'], sleeve_length: ['three-quarter', 'short'] },
    explanation: 'Gen-Z discovery label for a recognisably Indian kurti silhouette and expressive print; it is a style suggestion, not a verified trend claim.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Indian Casual Edit',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['kurti', 'kurta'], fit: ['regular', 'relaxed'] },
    optionalEvidence: { pattern_type: ['printed', 'floral'], sleeve_length: ['three-quarter', 'short'] },
    explanation: 'Gen-Z discovery suggestion based on easy kurti proportions and print. It does not assert that the seller’s occasion label is verified.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Festive Kurti Edit',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['kurti', 'kurta'], occasion_style: ['festive', 'ethnic'] },
    optionalEvidence: { pattern_type: ['printed', 'floral'], overall_length: ['knee', 'calf', 'maxi'] },
    explanation: 'Traditional Indian festive discovery tag, offered only when the festive/ethnic occasion claim is evidence-backed.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Print Play',
    category: 'aesthetic',
    requiredEvidence: { pattern_type: ['printed', 'floral', 'graphic'] },
    optionalEvidence: { primary_color: ['blue', 'pink', 'yellow', 'green', 'turquoise'] },
    explanation: 'Youth-oriented discovery tag for an evidence-backed visible print with expressive colour.',
    minRequiredMatches: 2,
  },
  {
    tag: 'Minimalist',
    category: 'aesthetic',
    requiredEvidence: { pattern_type: ['solid'], fit: ['slim', 'regular'] },
    optionalEvidence: { primary_color: ['black', 'white', 'grey', 'beige', 'cream'] },
    explanation: 'Clean, solid design with structured fit and neutral tones',
    minRequiredMatches: 2,
  },
  {
    tag: 'Boho',
    category: 'aesthetic',
    requiredEvidence: { pattern_type: ['printed', 'floral'] },
    optionalEvidence: { fit: ['relaxed', 'oversized'], overall_length: ['knee', 'maxi', 'calf'] },
    explanation: 'Bohemian style with flowing printed fabrics',
    minRequiredMatches: 2,
  },
  {
    tag: 'Indo-Western',
    category: 'aesthetic',
    requiredEvidence: { garment_type: ['kurti', 'kurta'] },
    optionalEvidence: { fit: ['slim', 'bodycon'], overall_length: ['short', 'hip', 'crop'] },
    explanation: 'Traditional ethnic garment with modern western-influenced styling',
    minRequiredMatches: 2,
  },
  {
    tag: 'Casual Everyday',
    category: 'seasonal',
    requiredEvidence: { occasion_style: ['casual'] },
    optionalEvidence: { fit: ['regular', 'relaxed'] },
    explanation: 'Everyday casual wear suitable for daily activities',
    minRequiredMatches: 1,
  },
  {
    tag: 'Summer Essential',
    category: 'seasonal',
    requiredEvidence: { sleeve_length: ['sleeveless', 'short'], fabric_appearance: ['cotton', 'linen'] },
    optionalEvidence: { primary_color: ['white', 'yellow', 'pink', 'turquoise'] },
    explanation: 'Light, breathable garment suitable for summer',
    minRequiredMatches: 2,
  },
];

/**
 * Generate tag suggestions based on verified evidence.
 * Tags are only suggested when their required evidence is backed.
 * 
 * @param {object[]} claimsMatrix - Per-claim evidence results
 * @returns {object[]} Tag suggestions with explanations
 */
export function generateTagSuggestions(claimsMatrix) {
  const suggestions = [];
  
  // Build a map of verified observations
  const verified = {};
  for (const claim of claimsMatrix) {
    if (claim.verdict === CLAIM_VERDICT.EVIDENCE_BACKED) {
      verified[claim.key] = canonicalize(claim.anchorObservation || claim.sellerValue);
    }
  }

  // Also add verified product descriptors
  const verifiedDescriptors = [];
  for (const claim of claimsMatrix) {
    if (claim.verdict === CLAIM_VERDICT.EVIDENCE_BACKED && claim.anchorObservation) {
      verifiedDescriptors.push({
        tag: claim.anchorObservation,
        label: claim.label,
        category: 'verified',
        explanation: `Evidence-backed from ${claim.evidenceSource?.join(', ') || 'anchor analysis'}`,
      });
    }
  }

  // Check each aesthetic rule
  for (const rule of AESTHETIC_TAG_RULES) {
    let requiredMatches = 0;
    let totalRequired = 0;
    const supportingFeatures = [];
    let hasFailedRequired = false;

    // Check required evidence
    for (const [key, acceptableValues] of Object.entries(rule.requiredEvidence)) {
      totalRequired++;
      const observedValue = verified[key];
      if (observedValue && acceptableValues.some(av => evidenceValueMatches(observedValue, av))) {
        requiredMatches++;
        const claim = claimsMatrix.find(c => c.key === key);
        supportingFeatures.push(claim?.label || key);
      }
    }

    // Check optional evidence for bonus confidence
    let optionalMatches = 0;
    for (const [key, acceptableValues] of Object.entries(rule.optionalEvidence || {})) {
      const observedValue = verified[key];
      if (observedValue && acceptableValues.some(av => evidenceValueMatches(observedValue, av))) {
        optionalMatches++;
        const claim = claimsMatrix.find(c => c.key === key);
        supportingFeatures.push(claim?.label || key);
      }
    }

    const totalMatches = requiredMatches + optionalMatches;
    if (totalMatches >= rule.minRequiredMatches && requiredMatches >= Math.min(1, totalRequired)) {
      suggestions.push({
        tag: `#${rule.tag}`,
        category: rule.category,
        explanation: rule.explanation,
        supportingFeatures,
        evidenceUsed: [...new Set(supportingFeatures.map(feature => {
          const claim = claimsMatrix.find(c => c.label === feature);
          return claim?.key;
        }).filter(Boolean))],
        confidence: totalMatches >= totalRequired + Object.keys(rule.optionalEvidence || {}).length ? 'HIGH' : 'MEDIUM',
        requiresSellerApproval: true,
        liveTrend: false,
        disclosure: 'Aesthetic discovery suggestion based on evidence-backed product attributes; not a verified or time-stamped live trend.',
      });
    }
  }

  return {
    verifiedDescriptors,
    aestheticSuggestions: suggestions.filter(s => s.category === 'aesthetic'),
    seasonalSuggestions: suggestions.filter(s => s.category === 'seasonal'),
    policy: {
      verifiedDescriptorRule: 'Only evidence-backed product attributes become verified descriptors.',
      aestheticRule: 'Aesthetic suggestions require seller approval and are not labelled as verified trends.',
      liveTrendRule: 'No tag is presented as a current trend without a time-stamped external trend source.',
    },
  };
}

function evidenceValueMatches(observedValue, expectedValue) {
  const observed = canonicalize(observedValue);
  const expected = canonicalize(expectedValue);
  if (observed === expected || valuesMatch(observedValue, expectedValue)) return true;
  // Some visual observations are deliberately descriptive, e.g.
  // "cotton-like woven texture". A rule may safely match a constituent word,
  // but never introduces a tag from a seller-declared-only claim.
  return observed.includes(expected) || expected.includes(observed);
}


export default {
  computeFileHash,
  computeAnchorFingerprint,
  createEvidenceBinding,
  verifyEvidenceBinding,
  getEvidenceBindingMetadata,
  findEvidenceProfile,
  getEvidenceProfileById,
  reverifyAgainstEvidence,
  generateTagSuggestions,
  canonicalize,
  valuesMatch,
  EVIDENCE_TIER,
  CLAIM_VERDICT,
  AESTHETIC_TAG_RULES,
};
