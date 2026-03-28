import { NextRequest, NextResponse } from 'next/server'
import { Part } from '@google/generative-ai'
import { getGeminiModel, analyseStyleFromImage } from '@/lib/gemini'
import { searchProducts, rewriteAffiliateUrl } from '@/lib/affiliate'
import { routeRequest } from '@/lib/gemini-router'
import { Product, OutfitBoard } from '@/lib/types'
import crypto from 'crypto'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB base64 ~ 7.5 MB decoded
const MAX_HISTORY_TURNS = 20

// ─── SSE helpers ──────────────────────────────────────────────────────────────

const encoder = new TextEncoder()

function sseEvent(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

/** Human-readable status label for each tool call */
function statusFor(name: string, args: Record<string, unknown>): string {
  if (name === 'search_products') {
    const category = args.category as string | undefined
    const query = args.query as string | undefined
    const label = category ?? query ?? 'items'
    return `Searching for ${label}…`
  }
  if (name === 'build_outfit_board') return 'Putting together your outfit board…'
  if (name === 'analyse_outfit_image') return 'Analysing your image…'
  if (name === 'get_product_details') return 'Fetching product details…'
  return 'Working on it…'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Validation (before opening the stream) ─────────────────────────────────
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: { message?: string; imageBase64?: string; imageMimeType?: string; history?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, imageBase64, imageMimeType, history = [] } = body

  if (!message && !imageBase64) {
    return NextResponse.json({ error: 'Message or image required' }, { status: 400 })
  }

  if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 10 MB)' }, { status: 413 })
  }

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

  // ── SSE stream ─────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseEvent(data))

      try {
        emit({ type: 'status', text: 'Reading your style request…' })

        // Only run Flash-Lite classification when there's an image — text-only
        // doesn't benefit from the pre-call and it adds ~500 ms of latency.
        const route = imageBase64
          ? await routeRequest({ userInput: message, imageBase64, imageMimeType })
          : { intentType: 'outfit_request' as const, imageContextHint: undefined }

        const productCache = new Map<string, Product>()
        const model = getGeminiModel()
        const chat = model.startChat({ history: safeHistory })

        const messageParts: Part[] = []
        if (imageBase64) {
          messageParts.push(analyseStyleFromImage(imageBase64, imageMimeType ?? 'image/jpeg') as Part)
        }
        const textWithContext = [route.imageContextHint, message].filter(Boolean).join('\n')
        if (textWithContext) messageParts.push({ text: textWithContext })

        emit({ type: 'status', text: 'Thinking about your look…' })

        let result = await chat.sendMessage(messageParts)
        let response = result.response
        let outfitBoard: OutfitBoard | null = null
        const collectedProducts = new Map<string, Product>()

        // Agentic loop — up to 10 turns
        for (let i = 0; i < 10; i++) {
          const functionCalls = response.functionCalls()
          if (!functionCalls || functionCalls.length === 0) break

          const functionResponses: Part[] = []

          for (const call of functionCalls) {
            // Send a status event so the user sees what Gemini is doing right now
            emit({ type: 'status', text: statusFor(call.name, call.args as Record<string, unknown>) })

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
              const { title, productIds, occasion } = call.args as {
                title: string
                productIds: string[]
                occasion?: string
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

              fnResult = { success: true, boardId: outfitBoard.id, productCount: boardProducts.length }
            } else {
              fnResult = { error: `Unknown function: ${call.name}` }
            }

            functionResponses.push({ functionResponse: { name: call.name, response: fnResult } })
          }

          result = await chat.sendMessage(functionResponses)
          response = result.response
        }

        const aiText = response.text()

        // Rewrite affiliate URLs server-side
        if (outfitBoard) {
          emit({ type: 'status', text: 'Finalising your board…' })
          outfitBoard.products = await Promise.all(
            outfitBoard.products.map(async (product) => ({
              ...product,
              affiliateUrl: await rewriteAffiliateUrl(product.productUrl),
            }))
          )
        }

        emit({ type: 'result', text: aiText, outfitBoard, hasBoard: !!outfitBoard })
      } catch (error) {
        console.error('Style API error:', error)
        emit({ type: 'error', error: 'Failed to process styling request' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no', // Disable Nginx/Netlify buffering
      'Connection': 'keep-alive',
    },
  })
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
