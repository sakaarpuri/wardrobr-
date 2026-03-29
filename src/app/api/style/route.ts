import { NextRequest, NextResponse } from 'next/server'
import { Part } from '@google/generative-ai'
import { getGeminiModel } from '@/lib/gemini'
import { searchProducts, rewriteAffiliateUrl } from '@/lib/affiliate'
import { routeRequest } from '@/lib/gemini-router'
import { Product, OutfitBoard } from '@/lib/types'
import { UserProfile, buildProfileContext, getBudgetCap, getBudgetStatus, getSearchPriceCap, normaliseUserProfile } from '@/lib/shopper'
import crypto from 'crypto'

// Allow up to 60s on Vercel (Pro) — Gemini agentic loop can take 15-25s
export const maxDuration = 60

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

// ─── File API upload ──────────────────────────────────────────────────────────

/**
 * Upload a base64-encoded image to the Gemini File API.
 * Returns a Part using fileData (works for vision) instead of inlineData (broken).
 */
async function uploadImagePart(base64: string, mimeType: string): Promise<Part> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Decode base64 → binary buffer
  const binary = Buffer.from(base64, 'base64')

  // Multipart upload to File API
  const boundary = `----WardrobrBoundary${Date.now()}`
  const metaJson = JSON.stringify({ file: { mimeType } })

  const parts: Buffer[] = [
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    binary,
    Buffer.from(`\r\n--${boundary}--`),
  ]
  const body = Buffer.concat(parts)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}&uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`File API upload failed ${res.status}: ${errText}`)
  }

  const data = await res.json() as { file?: { uri?: string; mimeType?: string } }
  const fileUri = data.file?.uri
  if (!fileUri) throw new Error('File API returned no URI')

  return { fileData: { mimeType, fileUri } } as Part
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Validation (before opening the stream) ─────────────────────────────────
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: { message?: string; imageBase64?: string; imageMimeType?: string; history?: unknown[]; profile?: Partial<UserProfile> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, imageBase64, imageMimeType, history = [], profile: rawProfile } = body
  const profile = normaliseUserProfile(rawProfile)

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

        const clarificationQuestion = getClarificationQuestion(message, profile, Boolean(imageBase64))
        if (clarificationQuestion) {
          emit({ type: 'result', text: clarificationQuestion, hasBoard: false })
          return
        }

        // ── Upload image to File API (needed for vision — inlineData not supported) ──
        let imagePart: Part | null = null
        if (imageBase64) {
          emit({ type: 'status', text: 'Uploading your photo…' })
          try {
            imagePart = await uploadImagePart(imageBase64, imageMimeType ?? 'image/jpeg')
          } catch (uploadErr) {
            console.error('Image upload failed:', uploadErr)
            emit({ type: 'status', text: 'Photo upload failed — continuing without image…' })
          }
        }

        // Only run Flash-Lite classification when there's an image — text-only
        // doesn't benefit from the pre-call and it adds ~500 ms of latency.
        const route = imageBase64
          ? await routeRequest({ userInput: message, imageBase64, imageMimeType })
          : { intentType: 'outfit_request' as const, imageContextHint: undefined }

        const productCache = new Map<string, Product>()
        const model = getGeminiModel()
        const chat = model.startChat({ history: safeHistory })

        const messageParts: Part[] = []
        if (imagePart) messageParts.push(imagePart)
        const shopperContext = buildProfileContext(profile)
        const textWithContext = [shopperContext, route.imageContextHint, message].filter(Boolean).join('\n')
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
              const searchResult = await searchProducts(applyShopperConstraints(params, profile))

              for (const product of searchResult.products) {
                collectedProducts.set(product.id, product)
                productCache.set(product.id, product)
              }

              // Emit products immediately so the UI can show them live
              if (searchResult.products.length > 0) {
                emit({ type: 'products', products: searchResult.products })
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
              const totalPrice = boardProducts.reduce((sum, product) => sum + product.price, 0)

              outfitBoard = {
                id: crypto.randomUUID(),
                title,
                products: boardProducts,
                createdAt: new Date().toISOString(),
                occasion,
                styleNote,
                totalPrice,
                budgetCap: getBudgetCap(profile.budget),
                budgetLabel: profile.budget,
                budgetRemaining: getBudgetCap(profile.budget) !== null
                  ? Number(((getBudgetCap(profile.budget) ?? 0) - totalPrice).toFixed(2))
                  : null,
                budgetStatus: getBudgetStatus(totalPrice, profile.budget),
                warnings: buildBoardWarnings(profile, totalPrice, boardProducts.map((product) => product.category)),
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

function applyShopperConstraints(
  params: {
    query: string
    category?: string
    minPrice?: number
    maxPrice?: number
    gender?: 'men' | 'women' | 'unisex'
    limit?: number
  },
  profile: UserProfile
) {
  const nextParams = { ...params }

  if (!nextParams.gender && profile.gender) {
    nextParams.gender = profile.gender
  }

  const priceCap = getSearchPriceCap(profile)
  if (priceCap) {
    nextParams.maxPrice = nextParams.maxPrice ? Math.min(nextParams.maxPrice, priceCap) : priceCap
  }

  return nextParams
}

function getClarificationQuestion(
  message: string | undefined,
  profile: UserProfile,
  hasImage: boolean
) {
  if (hasImage || !message) return null

  const text = message.trim().toLowerCase()
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const hasOccasion = /(wedding|interview|job|office|party|date|holiday|trip|brunch|festival|graduation|work|weekend|ceremony)/.test(text)
  const hasCategory = /(dress|blazer|jacket|coat|trousers|jeans|shoes|heels|sandals|bag|top|shirt|skirt|loafers|trainers|sneakers|suit)/.test(text)

  if (!profile.mission && wordCount <= 4 && !hasOccasion && !hasCategory) {
    return 'Are you after one key item or a full look?'
  }

  if ((profile.mission === 'full_look' || !profile.mission) && wordCount <= 6 && !hasOccasion && !hasCategory) {
    return 'What are you dressing for so I can steer the look properly?'
  }

  return null
}

function buildBoardWarnings(
  profile: UserProfile,
  totalPrice: number,
  categories: string[]
) {
  const warnings: string[] = ['Stock can change quickly on retailer pages.']

  if (profile.size) {
    warnings.push('Clothing size is still advisory, so double-check retailer availability before buying.')
  }

  if (categories.some((category) => category === 'shoes' || category === 'footwear') && !profile.shoeSize) {
    warnings.push('You have not set a shoe size yet, so shoe picks are based on style rather than fit.')
  }

  const budgetCap = getBudgetCap(profile.budget)
  if (budgetCap && totalPrice > budgetCap) {
    warnings.push('This board is over your stated budget.')
  }

  return warnings
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
