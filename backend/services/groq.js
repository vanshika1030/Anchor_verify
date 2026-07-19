/**
 * Groq Text-Only LLM Service
 * 
 * Used for listing metadata generation (Layer 5 of the hierarchical architecture).
 * Receives ONLY TEXT, never images. Uses llama-3.3-70b-versatile via Groq.
 * Free tier: 30 RPM, 6000 RPD — more than enough for text-only calls.
 */

import Groq from 'groq-sdk'

let groqClient = null

export function initGroq(apiKey) {
  if (!apiKey) {
    console.warn('[GROQ] No API key provided — Groq will not be available')
    return false
  }
  groqClient = new Groq({ apiKey })
  return true
}

export function isGroqAvailable() {
  return groqClient !== null
}

/**
 * Generate structured JSON from a text prompt using Groq.
 * @param {string} prompt - The text prompt (no images, ever)
 * @returns {Object} Parsed JSON response
 */
export async function groqGenerate(prompt) {
  if (!groqClient) {
    throw new Error('Groq client not initialized')
  }

  const completion = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a product listing expert for Myntra (India\'s largest fashion marketplace). You generate SEO-optimized listings. Always return valid JSON only, no markdown, no extra text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  })

  const text = completion.choices[0]?.message?.content || '{}'
  
  try {
    return JSON.parse(text)
  } catch (e) {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error(`Failed to parse Groq response as JSON: ${text.substring(0, 200)}`)
  }
}

/**
 * Generate Myntra listing metadata from verified attributes.
 * Text-only — no images sent to any API.
 */
export async function groqGenerateListingMetadata(attributes) {
  const prompt = `Generate a complete Myntra product listing based on these verified product attributes: ${JSON.stringify(attributes)}.

Return ONLY valid JSON with these exact keys:
{
  "title": "Product title, max 60 chars, SEO-optimized for Myntra search",
  "description": "2-3 sentence product description highlighting key features",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "key_features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category_path": "Women > Ethnic Wear > Kurtis",
  "ideal_for": "Women",
  "fabric_details": "Fabric composition",
  "care_instructions": "Wash care instructions",
  "size_fit_note": "Size and fit note for the buyer"
}`

  return groqGenerate(prompt)
}
