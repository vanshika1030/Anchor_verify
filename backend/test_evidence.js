import assert from 'node:assert/strict'
import {
  CLAIM_VERDICT,
  createEvidenceBinding,
  findEvidenceProfile,
  generateTagSuggestions,
  reverifyAgainstEvidence,
  verifyEvidenceBinding,
  valuesMatch,
} from './evidence_profile.js'
import { getDemoCachedResult } from './demo_registry.js'

const kurtiAnchors = [
  '../demo_data/anchors/kurti_front.jpeg',
  '../demo_data/anchors/kurti_back.jpeg',
  '../demo_data/anchors/kurti_closeup.jpeg',
]

const profileMatch = findEvidenceProfile(kurtiAnchors)
assert.ok(profileMatch, 'the exact Kurti fixture should have an evidence profile')
assert.equal(profileMatch.matchType, 'exact')
assert.equal(profileMatch.profile.productId, 'kurti')

// Partial anchors are deliberately not reusable evidence. This protects the
// demo from a new close-up/back image silently inheriting an old profile.
assert.equal(findEvidenceProfile(kurtiAnchors.slice(0, 2)), null)
assert.equal(findEvidenceProfile(['../backend/server.js', '../backend/server.js', '../backend/server.js']), null)

const correctClaims = {
  articleType: 'Kurti',
  primaryColour: 'Blue',
  secondaryColour: 'White',
  pattern: 'Printed',
  sleeveLength: 'Three-Quarter',
  garmentLength: 'Knee Length',
  fabric: 'Cotton',
  neckType: 'V-Neck',
  fit: 'Regular',
  occasion: 'Festive',
  modelSize: 'S',
  modelHeight: "5'6",
  sizeChart_S_chest: '36',
  sizeChart_S_length: '42',
  sizeChart_M_chest: '38',
  sizeChart_M_length: '42',
  sizeChart_L_chest: '40',
  sizeChart_L_length: '44',
}

const claim = (result, key) => result.claims.find(item => item.key === key)

const baseline = reverifyAgainstEvidence(correctClaims, profileMatch.profile, null)
assert.equal(baseline.summary.overallVerdict, 'PASS')
assert.ok(baseline.summary.evidenceBacked >= 8)
assert.equal(claim(baseline, 'primary_color').sellerDeclared.value, 'Blue')
assert.equal(claim(baseline, 'primary_color').anchorEvidence.value, 'Blue')
assert.equal(claim(baseline, 'primary_color').catalogEvidence.status, 'not_supplied')

assert.equal(claim(reverifyAgainstEvidence({ ...correctClaims, primaryColour: 'Red' }, profileMatch.profile), 'primary_color').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(reverifyAgainstEvidence({ ...correctClaims, pattern: 'Solid' }, profileMatch.profile), 'pattern_type').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(reverifyAgainstEvidence({ ...correctClaims, sleeveLength: 'Full Sleeve' }, profileMatch.profile), 'sleeve_length').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(reverifyAgainstEvidence({ ...correctClaims, fabric: 'Silk' }, profileMatch.profile), 'fabric_composition').verdict, CLAIM_VERDICT.SELLER_DECLARED)
assert.equal(claim(reverifyAgainstEvidence({ ...correctClaims, modelSize: 'M' }, profileMatch.profile), 'model_size').verdict, CLAIM_VERDICT.SELLER_DECLARED)

// CSV fields are imported assertions, not confirmations.  Physical imagery may
// validate garment attributes, but fabric composition and model disclosures
// need documentary evidence that is tied to the submitted catalog asset.
const strictCsvClaims = reverifyAgainstEvidence(correctClaims, profileMatch.profile, null, null, { source: 'csv' })
assert.equal(strictCsvClaims.summary.overallVerdict, 'FAIL')
assert.equal(claim(strictCsvClaims, 'fabric_composition').verdict, CLAIM_VERDICT.EVIDENCE_REQUIRED)
assert.equal(claim(strictCsvClaims, 'model_size').verdict, CLAIM_VERDICT.EVIDENCE_REQUIRED)
assert.equal(claim(strictCsvClaims, 'model_height').verdict, CLAIM_VERDICT.EVIDENCE_REQUIRED)

const invalidChart = reverifyAgainstEvidence({
  ...correctClaims,
  sizeChart_M_chest: '45',
  sizeChart_L_chest: '41',
}, profileMatch.profile)
assert.equal(claim(invalidChart, 'size_chart').verdict, CLAIM_VERDICT.MISMATCH)

// The finalist CSV intentionally calls this a short, casual, round-neck kurti
// with a 20-inch finished length.  The exact physical anchors say otherwise.
// This proves the demo catches the shopper-facing issue without fabricating a
// numerical model-body inference from catalog photographs.
const misleadingKurtiCsv = reverifyAgainstEvidence({
  ...correctClaims,
  neckType: 'Round Neck',
  garmentLength: 'Short',
  hemline: 'Straight',
  occasion: 'Casual',
  sizeChart_S_length: '20',
  sizeChart_M_length: '20',
  sizeChart_L_length: '20',
  sizeChart_XL_length: '20',
  modelBuild: 'Average',
}, profileMatch.profile)
assert.equal(misleadingKurtiCsv.summary.overallVerdict, 'FAIL')
assert.equal(claim(misleadingKurtiCsv, 'neck_type').verdict, CLAIM_VERDICT.EVIDENCE_BACKED, 'minor round/V-neck variation is allowed as a non-blocking equivalent')
assert.equal(claim(misleadingKurtiCsv, 'overall_length').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(misleadingKurtiCsv, 'hemline').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(misleadingKurtiCsv, 'occasion_style').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(misleadingKurtiCsv, 'size_chart_physical_length').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(misleadingKurtiCsv, 'model_build'), undefined, 'the blue-kurti fixture does not require model-build metadata')

// The CSV's catalog lane is an explicitly precomputed, signed fixture. It
// must appear beside the seller declaration and physical anchor rather than
// being flattened into a vague "catalog URL supplied" message.
const finalistCatalogFixture = {
  status: 'precomputed_exact_fixture',
  hasReferences: true,
  sources: ['Five signed finalist catalog references'],
  observations: {
    back_print_coverage: {
      value: 'Large gold paisley layout in the catalog back view',
      source: ['Catalog back'],
      detail: 'Does not preserve the fine white floral back print in the physical anchor.',
    },
    overall_length: {
      value: 'Knee-length silhouette visible in the catalog full-body view',
      source: ['Catalog full body'],
      detail: 'Conflicts with the CSV declaration of Short.',
    },
    model_size: {
      value: 'XL',
      source: ['Finalist catalog render manifest'],
      status: 'documented_manifest',
      detail: 'Catalog render metadata records XL; this is not a body-size guess from pixels.',
    },
    model_height: {
      value: "5'4\"",
      source: ['Finalist catalog render manifest'],
      status: 'documented_manifest',
      detail: 'Catalog render metadata records 5\'4\"; this is not a body-height guess from pixels.',
    },
  },
}
const threeWayKurti = reverifyAgainstEvidence({
  ...correctClaims,
  garmentLength: 'Short',
  modelSize: 'S',
}, profileMatch.profile, null, finalistCatalogFixture)
assert.equal(claim(threeWayKurti, 'overall_length').catalogEvidence.value, 'Knee-length silhouette visible in the catalog full-body view')
assert.equal(claim(threeWayKurti, 'overall_length').catalogEvidence.detail, 'Conflicts with the CSV declaration of Short.')
assert.equal(claim(threeWayKurti, 'model_size').catalogEvidence.status, 'documented_manifest')
assert.equal(claim(threeWayKurti, 'model_size').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(threeWayKurti, 'model_height').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(claim(threeWayKurti, 'model_height').severity, 'LOW')
assert.equal(claim(threeWayKurti, 'back_print_coverage').verdict, CLAIM_VERDICT.MISMATCH)
assert.equal(threeWayKurti.summary.criticalMismatches, 3, 'the fixture should group shopper issues without double-counting them')

const baselineTags = generateTagSuggestions(baseline.claims)
const redTags = generateTagSuggestions(reverifyAgainstEvidence({ ...correctClaims, primaryColour: 'Red' }, profileMatch.profile).claims)
assert.ok(baselineTags.verifiedDescriptors.length > redTags.verifiedDescriptors.length, 'mismatched facts must invalidate dependent verified tags')
assert.ok(baselineTags.aestheticSuggestions.some(tag => tag.tag === '#DesiCore'), 'the kurti fixture should expose an evidence-gated Gen-Z Indian style tag')
assert.ok(baselineTags.aestheticSuggestions.every(tag => tag.requiresSellerApproval && tag.liveTrend === false), 'aesthetic tags must not masquerade as verified live trends')

const binding = createEvidenceBinding(profileMatch.profile, kurtiAnchors)
assert.equal(verifyEvidenceBinding(binding, 'kurti'), true)
assert.equal(verifyEvidenceBinding(binding, 'croptop'), false)

const cropAnchors = [
  '../demo_data/anchors/croptop_front.jpeg',
  '../demo_data/anchors/croptop_back.jpeg',
  '../demo_data/anchors/croptop_closeup.jpeg',
]
const cropProfileMatch = findEvidenceProfile(cropAnchors)
assert.equal(cropProfileMatch?.profile.productId, 'croptop')
assert.equal(valuesMatch('crop length', 'Crop'), true, 'crop length is equivalent to crop')
assert.equal(valuesMatch('Regular', 'Slim / Bodycon'), true, 'the demo accepts the approved regular/bodycon fit equivalence')
const preparedCropPass = reverifyAgainstEvidence({
  garment_type: 'Crop Top',
  primary_color: 'Pink',
  secondary_color: 'Red',
  pattern_type: 'Solid',
  neck_type: 'Round Neck',
  sleeve_length: 'Short Sleeve',
  overall_length: 'Crop',
  fit: 'Regular',
  fabric_composition: 'Polyester Blend',
  occasion_style: 'Casual',
  model_size: 'M',
  model_height: "5'4\"",
}, cropProfileMatch.profile)
assert.equal(preparedCropPass.summary.overallVerdict, 'PASS', 'the exact prepared crop fixture should be publishable')
const cropTags = generateTagSuggestions(preparedCropPass.claims)
assert.ok(cropTags.aestheticSuggestions.some(tag => tag.tag === '#Pink Pop'))
assert.ok(cropTags.aestheticSuggestions.some(tag => tag.tag === '#Campus Core'))
const cachedGeneration = getDemoCachedResult({ model_size: 'M', model_height: "5'4\"" }, 'generate', [], cropAnchors)
assert.equal(cachedGeneration?.cache?.status, 'hit', 'exact fixture/configuration should receive the pre-rendered candidate')
assert.equal(getDemoCachedResult({ garment_type: 'Crop Top', model_size: 'M', model_height: "5'4\"" }, 'generate', [], kurtiAnchors), null, 'product text cannot select a cache result')
assert.equal(getDemoCachedResult({ garment_type: 'Kurti' }, 'verify', [], kurtiAnchors), null, 'CSV verification must never use demo cache')

console.log('Evidence, three-way matrix, and cache-safety tests passed.')
