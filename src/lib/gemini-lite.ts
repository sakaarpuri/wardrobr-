import { GoogleGenerativeAI } from '@google/generative-ai'

function getLiteGenAI() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenerativeAI(key)
}

export type IntentType =
  | 'outfit_request'
  | 'style_question'
  | 'product_search'
  | 'budget_query'
  | 'occasion_planning'
  | 'general_chat'

export interface ClassifyIntentResult {
  type: IntentType
  confidence: number
}

export interface ImageMetadata {
  colours: string[]
  categories: string[]
  gender: string
  formality: 'casual' | 'smart-casual' | 'formal' | 'athletic' | 'streetwear'
}

/**
 * Classify user intent using Flash-Lite (half the cost of Flash).
 * Used to route simple searches away from the full agentic loop.
 */
export async function classifyIntent(userInput: string): Promise<ClassifyIntentResult> {
  const model = getLiteGenAI().getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
    generationConfig: { temperature: 0, maxOutputTokens: 100 },
  })

  const prompt = `Classify this user message into exactly one category. Respond with JSON only, no markdown.

Categories: outfit_request, style_question, product_search, budget_query, occasion_planning, general_chat

Message: "${userInput.slice(0, 500)}"

Response: {"type": "<category>", "confidence": <0.0-1.0>}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const json = JSON.parse(text)
    return { type: json.type as IntentType, confidence: json.confidence ?? 0.8 }
  } catch {
    // Fall back to outfit_request — the main model handles it fine
    return { type: 'outfit_request', confidence: 0.5 }
  }
}

/**
 * Extract image metadata using Flash-Lite before the full styling pass.
 * Returns colours, categories, gender, and formality — passed to Flash as context.
 */
export async function classifyImage(
  base64Image: string,
  mimeType = 'image/jpeg'
): Promise<ImageMetadata> {
  const model = getLiteGenAI().getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
    generationConfig: { temperature: 0, maxOutputTokens: 200 },
  })

  const prompt = `Analyse this clothing image and extract metadata. Respond with JSON only, no markdown.

Response format:
{"colours": ["<dominant colours>"], "categories": ["<clothing categories visible>"], "gender": "<men|women|unisex>", "formality": "<casual|smart-casual|formal|athletic|streetwear>"}`

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } },
    ])
    const text = result.response.text().trim()
    const json = JSON.parse(text)
    return {
      colours: json.colours ?? [],
      categories: json.categories ?? [],
      gender: json.gender ?? 'unisex',
      formality: json.formality ?? 'casual',
    }
  } catch {
    return { colours: [], categories: [], gender: 'unisex', formality: 'casual' }
  }
}
