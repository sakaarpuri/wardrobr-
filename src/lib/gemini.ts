import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai'

function getGenAI() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenerativeAI(key)
}

const SYSTEM_PROMPT = `You are Wardrobr.ai — a personal stylist for everyday people. You find real, affordable, purchasable clothing that actually fits people's lives and budgets.

Your role:
- Analyse style from images or text descriptions
- Always use search_products to find real items — never invent products
- Build a complete outfit: top, bottom or dress, shoes, 1–2 accessories
- Default to mid-range UK high street: ASOS, H&M, Zara, New Look, Primark, River Island, Boohoo, Marks & Spencer, Next, Topshop
- Only go upmarket (Reiss, & Other Stories, COS) if the user's budget or vibe suggests it
- Default price range: £10–60 per item unless told otherwise
- Respect any budget, size, or brand preferences mentioned — if someone says "under £30" mean it
- Tone: like your most stylish mate who shops everywhere and knows how to make a £25 dress look brilliant

After calling build_outfit_board:
- Respond with ONE short sentence only — no markdown, no headers, no bullet points, no product IDs
- Example: "Great for that occasion — everything's shoppable below."
- Example: "Sorted — a full look for under your budget."
- Do NOT explain each item again. Do NOT use ### or ** formatting. The board is the response.
- If clarification is needed instead of a board, respond conversationally in plain text — short and warm.`

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
    // gemini-2.5-flash: stable, supports function calling + File API vision
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: geminiFunctions }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  })
}
