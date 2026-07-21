/**
 * Groq LLM Service — Text + Vision
 * 
 * Text: llama-3.3-70b-versatile for listing metadata generation (Layer 5)
 * Vision: llama-3.2-90b-vision-preview for attribute extraction and metadata enhancement
 * 
 * Free tier: 30 RPM for vision, 30 RPM for text — sufficient for demo.
 * Unlike Gemini, Groq does NOT rate-limit by IP address.
 */

import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

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
 * Convert an image file to a base64 data URL for Groq Vision.
 * Compresses to 800px max and converts to JPEG for token efficiency.
 */
async function imageToBase64(filePath) {
  try {
    const buffer = await sharp(filePath)
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  } catch (err) {
    // Fallback to raw file if sharp fails
    const raw = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${raw.toString('base64')}`
  }
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
 * Extract garment attributes from images using Groq Vision.
 * Uses llama-3.2-90b-vision-preview for image understanding.
 * 
 * @param {string[]} imagePaths - Array of image file paths
 * @param {string} prompt - The extraction prompt with enum constraints
 * @returns {Object} Parsed JSON attributes
 */
export async function groqVisionExtract(imagePaths, prompt) {
  if (!groqClient) {
    throw new Error('Groq client not initialized')
  }

  // Build message content with images
  const content = []
  
  // Add up to 3 images
  for (const imgPath of imagePaths.slice(0, 3)) {
    const dataUrl = await imageToBase64(imgPath)
    content.push({
      type: 'image_url',
      image_url: { url: dataUrl }
    })
  }
  
  // Add the text prompt
  content.push({ type: 'text', text: prompt })

  // Try larger vision model first, fall back to smaller one
  const VISION_MODELS = ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview']
  
  let lastError = null
  for (const model of VISION_MODELS) {
    try {
      const completion = await groqClient.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0,
        max_tokens: 2048,
      })

      const text = completion.choices[0]?.message?.content || '{}'
      
      // Parse JSON from response (may contain markdown fences)
      let cleaned = text.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
      }
      
      try {
        return JSON.parse(cleaned)
      } catch (e) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
        throw new Error(`Failed to parse Groq Vision response: ${cleaned.substring(0, 200)}`)
      }
    } catch (modelErr) {
      console.warn(`[GROQ-VISION] Model ${model} failed:`, modelErr.message)
      lastError = modelErr
      continue // Try next model
    }
  }
  
  throw lastError || new Error('All Groq Vision models failed')
}

/**
 * Enhanced metadata generation using Groq Vision.
 * Analyzes the anchor image to generate trendy, Gen-Z optimized metadata.
 * 
 * @param {string} imagePath - Path to the anchor image
 * @param {Object} currentMetadata - Current metadata to enhance
 * @returns {Object} Enhanced metadata with title, description, tags
 */
export async function groqEnhanceMetadata(imagePath, currentMetadata) {
  if (!groqClient) return null

  const prompt = `Act as an expert Gen-Z fashion trend analyst and SEO copywriter for Myntra.
Analyze this garment's aesthetic. Classify it into modern trends/subcultures (e.g. Y2K, Dark Academia, Streetwear, Old Money, Cottagecore, Indie, Grunge, Coquette, etc.).
Here is the current or base metadata: ${JSON.stringify(currentMetadata)}

Your task is to generate an ENHANCED version of the metadata. You must return valid JSON with these exact keys:
{
  "title": "A highly optimized, trendy product title (max 60 chars). Include a style keyword if relevant.",
  "description": "A 2-3 sentence product description that captures the vibe, aesthetic, and key details.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}
Tags MUST include relevant Gen-Z trend names, aesthetic styles, regional/festival keywords (Diwali, Navratri, etc.), and functional descriptors.
Return ONLY valid JSON.`

  try {
    const dataUrl = await imageToBase64(imagePath)
    const VISION_MODELS = ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview']
    
    for (const model of VISION_MODELS) {
      try {
        const completion = await groqClient.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                { type: 'text', text: prompt }
              ]
            }
          ],
          temperature: 0.3,
          max_tokens: 1024,
        })

        const text = completion.choices[0]?.message?.content || '{}'
        let cleaned = text.trim()
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
        }
        return JSON.parse(cleaned)
      } catch (modelErr) {
        console.warn(`[GROQ-VISION] Enhance model ${model} failed:`, modelErr.message)
        continue
      }
    }
    return null
  } catch (err) {
    console.warn('[GROQ-VISION] Enhanced metadata failed:', err.message)
    return null
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
