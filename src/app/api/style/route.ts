import { NextRequest, NextResponse } from 'next/server'
import { Part } from '@google/generative-ai'
import { getGeminiModel, analyseStyleFromImage } from '@/lib/gemini'
import { searchProducts, rewriteAffiliateUrl } from '@/lib/affiliate'
import { Product, OutfitBoard } from '@/lib/types'
import crypto from 'crypto'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB base64 ~ 7.5 MB decoded
const MAX_HISTORY_TURNS = 20

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get('content-length')
    if (contentLength && Number(contentLength) > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    const body = await req.json()
    const { message, imageBase64, imageMimeType, history = [] } = body

    if (!message && !imageBase64) {
      return NextResponse.json({ error: 'Message or image required' }, { status: 400 })
    }

    // Validate image size
    if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 10 MB)' }, { status: 413 })
    }

    // Validate + sanitize history — only accept plain text turns, cap length
    const safeHistory = Array.isArray(history)
      ? history
          .slice(-MAX_HISTORY_TURNS)
          .filter(
            (h: unknown): h is { role: string; parts: { text: string }[] } =>
              typeof h === 'object' &&
              h !== null &&
              ((h as { role: string }).role === 'user' || (h as { role: string }).role === 'model')
          )
          .map((h: { role: string; parts: { text: string }[] }) => ({
            role: h.role === 'user' ? 'user' : ('model' as const),
            parts: [{ text: String(h.parts?.[0]?.text ?? '').slice(0, 2000) }],
          }))
      : []

    // Request-scoped product cache — never shared across requests
    const productCache = new Map<string, Product>()

    const model = getGeminiModel()
    const chat = model.startChat({ history: safeHistory })

    // Build the user message parts
    const messageParts: Part[] = []
    if (imageBase64) {
      messageParts.push(analyseStyleFromImage(imageBase64, imageMimeType ?? 'image/jpeg') as Part)
    }
    if (message) {
      messageParts.push({ text: message })
    }

    // Agentic loop: send message, handle function calls, repeat
    let result = await chat.sendMessage(messageParts)
    let response = result.response
    let outfitBoard: OutfitBoard | null = null
    let aiText = ''
    const collectedProducts: Map<string, Product> = new Map()

    // Process function calls in a loop (up to 10 turns)
    for (let i = 0; i < 10; i++) {
      const functionCalls = response.functionCalls()
      if (!functionCalls || functionCalls.length === 0) break

      const functionResponses: Part[] = []

      for (const call of functionCalls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fnResult: any

        if (call.name === 'search_products') {
          const params = call.args as {
            query: string
            category?: string
            minPrice?: number
            maxPrice?: number
            gender?: 'men' | 'women' | 'unisex'
            limit?: number
          }
          const searchResult = await searchProducts(params)

          // Cache products for later use by build_outfit_board
          for (const product of searchResult.products) {
            collectedProducts.set(product.id, product)
            productCache.set(product.id, product)
          }

          fnResult = {
            products: searchResult.products.map(p => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              price: p.price,
              currency: p.currency,
              storeName: p.storeName,
              category: p.category,
              description: p.description,
            })),
            total: searchResult.total,
          }
        } else if (call.name === 'get_product_details') {
          const { productId } = call.args as { productId: string }
          const product = collectedProducts.get(productId) ?? productCache.get(productId)
          fnResult = product ?? { error: 'Product not found' }
        } else if (call.name === 'analyse_outfit_image') {
          const { imageDescription } = call.args as { imageDescription: string }
          fnResult = {
            colours: extractColours(imageDescription),
            categories: extractCategories(imageDescription),
            styleTags: extractStyleTags(imageDescription),
            formality: extractFormality(imageDescription),
            description: imageDescription,
          }
        } else if (call.name === 'build_outfit_board') {
          const { title, productIds, occasion, styleNote } = call.args as {
            title: string
            productIds: string[]
            occasion?: string
            styleNote?: string
          }

          const boardProducts = productIds
            .map(id => collectedProducts.get(id) ?? productCache.get(id))
            .filter((p): p is Product => !!p)

          outfitBoard = {
            id: crypto.randomUUID(),
            title,
            products: boardProducts,
            createdAt: new Date().toISOString(),
            occasion,
          }

          fnResult = {
            success: true,
            boardId: outfitBoard.id,
            productCount: boardProducts.length,
          }
        } else {
          fnResult = { error: `Unknown function: ${call.name}` }
        }

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: fnResult,
          },
        })
      }

      result = await chat.sendMessage(functionResponses)
      response = result.response
    }

    // Extract final text response
    aiText = response.text()

    // Rewrite all affiliate URLs server-side before sending to client
    if (outfitBoard) {
      outfitBoard.products = await Promise.all(
        outfitBoard.products.map(async (product) => ({
          ...product,
          affiliateUrl: await rewriteAffiliateUrl(product.productUrl),
        }))
      )
    }

    return NextResponse.json({
      text: aiText,
      outfitBoard,
      hasBoard: !!outfitBoard,
    })
  } catch (error) {
    console.error('Style API error:', error)
    return NextResponse.json(
      { error: 'Failed to process styling request' },
      { status: 500 }
    )
  }
}

// ─── Simple extraction helpers ────────────────────────────────────────────────

function extractColours(text: string): string[] {
  const colours = ['black', 'white', 'grey', 'beige', 'cream', 'brown', 'navy', 'blue', 'green', 'red', 'pink', 'purple', 'yellow', 'orange', 'tan', 'camel', 'ecru', 'ivory']
  return colours.filter(c => text.toLowerCase().includes(c))
}

function extractCategories(text: string): string[] {
  const categories = ['blazer', 'jacket', 'coat', 'trousers', 'jeans', 'skirt', 'dress', 'top', 'shirt', 'blouse', 'shoes', 'boots', 'sneakers', 'bag', 'accessories']
  return categories.filter(c => text.toLowerCase().includes(c))
}

function extractStyleTags(text: string): string[] {
  const tags = ['casual', 'formal', 'smart-casual', 'streetwear', 'minimalist', 'maximalist', 'vintage', 'preppy', 'boho', 'athleisure', 'coastal', 'old money', 'quiet luxury']
  return tags.filter(t => text.toLowerCase().includes(t))
}

function extractFormality(text: string): 'casual' | 'smart-casual' | 'formal' | 'athletic' | 'streetwear' {
  const t = text.toLowerCase()
  if (t.includes('formal') || t.includes('office') || t.includes('work')) return 'formal'
  if (t.includes('smart') || t.includes('business casual')) return 'smart-casual'
  if (t.includes('athletic') || t.includes('gym') || t.includes('sport')) return 'athletic'
  if (t.includes('street') || t.includes('hype')) return 'streetwear'
  return 'casual'
}
