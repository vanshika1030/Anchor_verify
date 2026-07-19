/**
 * Bayesian Mathematical Fusion Engine
 * 
 * This engine takes independent sensory inputs (CLIP, pHash, and LLM/ViT Attributes)
 * and mathematically fuses them using Bayesian Evidence Updating to produce a single
 * deterministic "Match Probability" between 0% and 100%.
 */

// Prior probability that any two items matched at random actually match
const PRIOR_MATCH_PROBABILITY = 0.50;

/**
 * Updates a probability using Bayes' Theorem given new evidence.
 * P(A|B) = [ P(B|A) * P(A) ] / [ P(B|A)*P(A) + P(B|~A)*P(~A) ]
 * 
 * We use Odds form for numerical stability:
 * Posterior_Odds = Prior_Odds * Likelihood_Ratio
 */
function updateProbability(priorProb, likelihoodRatio) {
  if (likelihoodRatio === null || likelihoodRatio === undefined) return priorProb;
  
  const priorOdds = priorProb / (1 - priorProb);
  const posteriorOdds = priorOdds * likelihoodRatio;
  return posteriorOdds / (1 + posteriorOdds);
}

/**
 * Calculates Likelihood Ratio from CLIP Cosine Similarity.
 * Cosine similarity > 0.8 is strong evidence of a match.
 * Cosine similarity < 0.6 is strong evidence of a mismatch.
 */
function getClipLikelihoodRatio(clipScore) {
  if (typeof clipScore !== 'number') return null;
  
  // Transform CLIP score (usually 0.5 to 1.0) into a likelihood ratio
  if (clipScore >= 0.85) return 10.0; // Very strong match evidence
  if (clipScore >= 0.75) return 3.0;  // Moderate match evidence
  if (clipScore >= 0.65) return 1.0;  // Neutral
  if (clipScore >= 0.55) return 0.2;  // Moderate mismatch evidence
  return 0.05;                        // Very strong mismatch evidence
}

/**
 * Calculates Likelihood Ratio from pHash Distance.
 * Distance 0-5 is a near-perfect duplicate.
 * Distance > 20 is completely different image visually.
 */
function getPhashLikelihoodRatio(phashDistance) {
  if (typeof phashDistance !== 'number') return null;
  
  if (phashDistance <= 10) return 5.0;  // Strong structural match
  if (phashDistance <= 20) return 2.0;  // Weak structural match
  return 1.0;                           // Neutral (different angles yield high pHash distance, so don't penalize heavily)
}

/**
 * Calculates Likelihood Ratio from Attribute Verification (Gemini/ViT).
 * Weighs the number of 'match' vs 'mismatch' weighted by their severity.
 */
function getAttributesLikelihoodRatio(comparison) {
  if (!Array.isArray(comparison) || comparison.length === 0) return null;

  let score = 0;
  
  comparison.forEach(attr => {
    if (attr.status === 'match') {
      score += (attr.severity === 'HIGH' ? 2.0 : 1.0);
    } else if (attr.status === 'mismatch') {
      score -= (attr.severity === 'HIGH' ? 3.0 : 1.0); // Mismatches penalize harder
    } else if (attr.status === 'warning') {
      score -= 0.5;
    }
  });

  // Convert the additive score to a Likelihood Ratio multiplier
  // e.g., A score of +5 gives LR = e^(0.5 * 5) = ~12
  // A score of -3 gives LR = e^(0.5 * -3) = ~0.22
  const likelihoodRatio = Math.exp(0.5 * score);
  
  // Cap the extremes to prevent infinite certainty
  return Math.max(0.01, Math.min(likelihoodRatio, 100.0));
}

export function calculateBayesianFusion(clipScore, phashDistance, comparisonArray) {
  let currentProb = PRIOR_MATCH_PROBABILITY;

  // 1. Fuse CLIP evidence
  const lrClip = getClipLikelihoodRatio(clipScore);
  currentProb = updateProbability(currentProb, lrClip);

  // 2. Fuse pHash evidence
  const lrPhash = getPhashLikelihoodRatio(phashDistance);
  currentProb = updateProbability(currentProb, lrPhash);

  // 3. Fuse Attribute evidence
  const lrAttrs = getAttributesLikelihoodRatio(comparisonArray);
  currentProb = updateProbability(currentProb, lrAttrs);

  return {
    probability: (currentProb * 100).toFixed(1), // Percentage string
    breakdown: {
      prior: PRIOR_MATCH_PROBABILITY,
      lr_clip: lrClip,
      lr_phash: lrPhash,
      lr_attributes: lrAttrs
    }
  };
}
