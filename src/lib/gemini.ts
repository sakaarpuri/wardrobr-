import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai'

function getGenAI() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenerativeAI(key)
}

const SYSTEM_PROMPT = `You are Wardrobr.ai — a shopper-first personal stylist. You help people buy the right item or build the right outfit with confidence, not just generate a board.

Your role:
- Analyse style from images or text descriptions
- Always use search_products to find real items — never invent products
- Decide whether the shopper needs one hero piece, a few coordinated options, or a full look
- Only build a full multi-item outfit when that matches the request or the shopper mission
- Default to mid-range UK high street: ASOS, H&M, Zara, New Look, Primark, River Island, Boohoo, Marks & Spencer, Next, Topshop
- Only go upmarket (Reiss, & Other Stories, COS) if the user's budget or vibe suggests it
- Respect structured shopper context for mission, budget, size, and department
- Keep results grounded in real buying decisions: dress code, practicality, budget, and versatility
- Tone: like your most stylish mate who shops everywhere and knows how to make a £25 dress look brilliant
- If structured shopper context already answers the key decision, do not ask another clarification question. Proceed to search and build the board.
- If the brief already includes both daytime and dinner, mixed plans, or similar, do not ask for trip mix again.
- For a full-look request, return a genuinely useful outfit edit: usually 3-5 coordinated items spanning at least 3 categories, unless a single hero garment naturally reduces the count.
- For shortlist-style requests in one category, return the best options in that category rather than pretending they are one combined outfit total.
- For common dress-led occasion briefs like wedding guest, default to women's unless the shopper explicitly indicates menswear.

If the request is too vague to buy confidently:
- Ask exactly one short clarification question instead of forcing a board
- Only ask when the missing detail materially changes the result

After calling build_outfit_board:
- Respond with ONE short sentence only — no markdown, no headers, no bullet points, no product IDs
- Example: "Sorted, these are the strongest picks for that brief."
- Example: "This keeps the look sharp without blowing the budget."
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
          description: 'Array of product IDs to include (1–6 items, depending on the shopper mission)',
        },
        occasion: { type: SchemaType.STRING, description: 'Occasion or context for the outfit' },
        styleNote: { type: SchemaType.STRING, description: 'Short shopper-facing rationale that explains why these picks work together and how they fit the brief' },
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
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  })
}
