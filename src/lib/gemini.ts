import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai'

function getGenAI() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenerativeAI(key)
}

const SYSTEM_PROMPT = `You are Wardrobr.ai, an expert personal stylist with a sharp eye for fashion and a deep knowledge of current trends. You help users discover real, purchasable clothing that matches their style.

Your role:
- Analyse style from images or text descriptions
- Recommend complete, cohesive outfit combinations
- Always use the search_products tool to find real items — never invent product names or URLs
- Explain your styling choices in 1–2 sentences per item
- Focus on UK fashion retailers (ASOS, H&M, Zara, Boohoo, Topshop, & Other Stories, COS)
- Keep recommendations within realistic price ranges unless asked otherwise
- Be confident, editorial, and warm — like a friend who works in fashion

Response style:
- Lead with a brief style read (2–3 sentences)
- Build a complete outfit (top, bottom/dress, outerwear if needed, shoes, 1–2 accessories)
- Use search_products for each category, then build_outfit_board with the best results
- Always call build_outfit_board at the end to present the final selection`

export const geminiFunctions: FunctionDeclaration[] = [
  {
    name: 'search_products',
    description: 'Search for real purchasable fashion products from UK retailers via affiliate feed',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Search query, e.g. "oversized beige linen blazer"' },
        category: { type: SchemaType.STRING, description: 'Category: tops, bottoms, dresses, outerwear, shoes, accessories, bags' },
        minPrice: { type: SchemaType.NUMBER, description: 'Minimum price in GBP' },
        maxPrice: { type: SchemaType.NUMBER, description: 'Maximum price in GBP' },
        gender: { type: SchemaType.STRING, description: 'Filter by gender: men, women, unisex' },
        limit: { type: SchemaType.NUMBER, description: 'Number of results (default 5, max 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Get full details for a specific product by ID',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING, description: 'Product ID from search results' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'analyse_outfit_image',
    description: 'Analyse an outfit image to extract style attributes',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        imageDescription: { type: SchemaType.STRING, description: 'Describe what you see in the image' },
      },
      required: ['imageDescription'],
    },
  },
  {
    name: 'build_outfit_board',
    description: 'Compose the final outfit board from selected products. Call this last, after searching for all items.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Short outfit title, e.g. "Relaxed Weekend Edit"' },
        productIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Array of product IDs to include (3–6 items)',
        },
        occasion: { type: SchemaType.STRING, description: 'Occasion or context for the outfit' },
        styleNote: { type: SchemaType.STRING, description: 'Overall stylist note for the outfit (2–3 sentences)' },
      },
      required: ['title', 'productIds'],
    },
  },
]

export function getGeminiModel() {
  return getGenAI().getGenerativeModel({
    model: 'gemini-3-flash-preview',
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: geminiFunctions }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  })
}

export function analyseStyleFromImage(base64Image: string, mimeType: string = 'image/jpeg') {
  return {
    inlineData: {
      data: base64Image,
      mimeType,
    },
  }
}

