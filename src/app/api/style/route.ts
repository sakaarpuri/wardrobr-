import { NextRequest, NextResponse } from 'next/server'
import { Part } from '@google/generative-ai'
import { getGeminiModel } from '@/lib/gemini'
import { SearchProviderUnavailableError, searchProducts, rewriteAffiliateUrl } from '@/lib/affiliate'
import { routeRequest } from '@/lib/gemini-router'
import { ClarificationGroup, ClarificationPrompt, Product, OutfitBoard } from '@/lib/types'
import { UserProfile, buildProfileContext, extractSpecificItemCategories, getBudgetCap, getBudgetLabel, getBudgetStatus, getSearchPriceCap, inferProfileFromReply, isLikelyShoppingRelevant, isSingleSpecificItemRequest, isUnsupportedShopperSegment, normaliseUserProfile } from '@/lib/shopper'
import { buildMemberMemoryContext, getMemberMemorySnapshot } from '@/lib/member-memory'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
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
  const lastAssistantText = [...safeHistory].reverse().find((entry) => entry.role === 'model')?.parts?.[0]?.text ?? null
  const profile = {
    ...normaliseUserProfile(rawProfile),
    ...inferProfileFromReply(message ?? '', normaliseUserProfile(rawProfile), lastAssistantText),
  }
  let memberMemoryContext = ''

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseClient()
      const snapshot = await getMemberMemorySnapshot(supabase)
      memberMemoryContext = buildMemberMemoryContext(snapshot)
    } catch {
      memberMemoryContext = ''
    }
  }

  // ── SSE stream ─────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseEvent(data))

      try {
        emit({ type: 'status', text: 'Reading your style request…' })

        const route = imageBase64
          ? await routeRequest({ userInput: message, imageBase64, imageMimeType })
          : await routeRequest({ userInput: message })

        const scopeMessage = getScopeGuardMessage(message, route.intentType, Boolean(imageBase64))
        if (scopeMessage) {
          emit({ type: 'result', text: scopeMessage, hasBoard: false })
          return
        }

        const unsupportedMessage = getUnsupportedShopperMessage(message)
        if (unsupportedMessage) {
          emit({ type: 'result', text: unsupportedMessage, hasBoard: false })
          return
        }

        const clarificationPrompt = getClarificationPrompt(message, profile, Boolean(imageBase64), route.intentType)
        if (clarificationPrompt) {
          emit({ type: 'result', text: clarificationPrompt.question, clarification: clarificationPrompt, hasBoard: false })
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
        const productCache = new Map<string, Product>()
        const model = getGeminiModel()
        const chat = model.startChat({ history: safeHistory })

        const messageParts: Part[] = []
        if (imagePart) messageParts.push(imagePart)
        const shopperContext = buildProfileContext(profile)
        const textWithContext = [shopperContext, memberMemoryContext, route.imageContextHint, message].filter(Boolean).join('\n')
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
              const boardType = getBoardType(boardProducts)
              const pricingReference = getBudgetReferenceTotal(boardProducts, boardType)
              const budgetCap = getBudgetCap(profile.budget, profile.budgetMax)

              outfitBoard = {
                id: crypto.randomUUID(),
                title,
                products: boardProducts,
                boardType,
                createdAt: new Date().toISOString(),
                occasion,
                styleNote,
                totalPrice: boardType === 'shortlist' ? undefined : totalPrice,
                budgetCap,
                budgetLabel: getBudgetLabel(profile),
                budgetRemaining: budgetCap !== null
                  ? Number((budgetCap - pricingReference).toFixed(2))
                  : null,
                budgetStatus: getBudgetStatus(pricingReference, profile.budget, profile.budgetMax),
                warnings: buildBoardWarnings(profile, pricingReference, boardProducts.map((product) => product.category), boardType),
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
        emit({
          type: 'error',
          error: error instanceof SearchProviderUnavailableError
            ? error.message
            : 'Failed to process styling request',
        })
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

function getClarificationPrompt(
  message: string | undefined,
  profile: UserProfile,
  hasImage: boolean,
  intentType?: string
): ClarificationPrompt | null {
  if (hasImage || !message) return null

  const genderPrompt = getGenderClarificationPrompt(message, profile)
  if (genderPrompt) return genderPrompt

  const travelPrompt = getTravelClarificationPrompt(message, profile)
  if (travelPrompt) return travelPrompt

  const text = message.trim().toLowerCase()
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const hasOccasion = /(wedding|interview|job|office|party|date|holiday|trip|brunch|festival|graduation|work|weekend|ceremony)/.test(text)
  const hasCategory = extractSpecificItemCategories(text).length > 0

  if (!profile.mission && wordCount <= 6 && !hasCategory && intentType !== 'product_search') {
    if (!hasOccasion || wordCount <= 3) {
      return {
        question: 'Pick the route and I’ll shop it.',
        groups: [buildMissionClarificationGroup()],
        ctaLabel: 'Show my picks',
      }
    }
  }

  return null
}

function getGenderClarificationPrompt(
  message: string,
  profile: UserProfile
): ClarificationPrompt | null {
  if (profile.gender) return null

  const text = message.trim().toLowerCase()
  const hasShoppingCue = /(outfit|look|capsule|wardrobe|wedding|interview|date|party|holiday|trip|travel|brunch|formal|dressy|casual|occasion|what should i wear|what to wear)/.test(text)
  const hasSpecificItem = extractSpecificItemCategories(text).length > 0
  const clearlyWomens = /\b(dress|skirt|heels|bra|bralette|maternity|bridal)\b/.test(text)
  const clearlyMens = /\b(suit|tie|tuxedo|brogues|groom suit|best man)\b/.test(text)
  const explicitlyUnisex = /\bunisex\b/.test(text)

  if (explicitlyUnisex || clearlyWomens || clearlyMens) return null

  const shouldAsk =
    !hasSpecificItem &&
    (
      hasShoppingCue ||
      /(job|office|wedding|party|holiday|trip|travel|interview|date|brunch|gala|ceremony|event)/.test(text)
    )

  if (!shouldAsk) return null

  return {
    question: 'One quick thing before I shop it: are we shopping for women or men?',
    groups: [buildGenderClarificationGroup()],
    ctaLabel: 'Show my picks',
  }
}

function getTravelClarificationPrompt(
  message: string,
  profile: UserProfile
): ClarificationPrompt | null {
  const text = message.trim().toLowerCase()
  const isTravelRequest = /(travel|trip|holiday|vacation|heading to|going to|flying to|city break|weekend away|packing)/.test(text)

  if (!isTravelRequest) {
    return null
  }

  const destinationMatch = message.match(/(?:travel|heading|going|flying|trip|holiday)\s+(?:to|for|in)\s+(.+?)(?:\s+(next week|this weekend|next month|tomorrow|soon)\b|$)/i)
  const timingMatch = message.match(/\b(next week|this weekend|next month|tomorrow|soon)\b/i)
  const destination = destinationMatch?.[1]?.replace(/[,.!?]+$/g, '').trim()
  const timing = timingMatch?.[1]?.toLowerCase() ?? null
  const warmDestination = /(las palmas|la palma|gran canaria|tenerife|mallorca|majorca|ibiza|canary islands|barcelona|lisbon|amalfi|mykonos|athens|nice|miami|dubai)/.test(text)
  const alreadyHasMixedTrip = /\bboth\b|\bmixed\b|\ba mix\b|daytime and dinner|day and dinner|daytime \+ dinner|day and night|beach and dinner/.test(text)
  const specificItemRequest = isSingleSpecificItemRequest(text)
  const groups: ClarificationGroup[] = []

  if (!profile.tripPreference && !alreadyHasMixedTrip) {
    groups.push({
      id: 'trip_preference' as const,
      label: 'Trip mix',
      options: [
        {
          id: 'daytime',
          label: warmDestination ? 'Beach + walking' : 'Daytime + casual',
          helper: warmDestination ? 'Easy daytime outfits first.' : 'Keep it relaxed and practical.',
          profilePatch: { tripPreference: 'daytime' },
        },
        {
          id: 'mixed',
          label: 'Both',
          helper: 'Cover daytime plans and dressier dinners.',
          profilePatch: { tripPreference: 'mixed' },
        },
        {
          id: 'dressy',
          label: 'Dressier',
          helper: 'Bias toward sharper evening options.',
          profilePatch: { tripPreference: 'dressy' },
        },
      ],
    })
  }

  if (!profile.mission && !specificItemRequest) {
    groups.push(buildMissionClarificationGroup())
  }

  if (groups.length === 0) {
    return null
  }

  if (destination) {
    const lead = warmDestination
      ? `Heading to ${toTitleCase(destination)}${timing ? ` ${timing}` : ''}, I’d start with a warm-weather travel capsule.`
      : `Heading to ${toTitleCase(destination)}${timing ? ` ${timing}` : ''}, I’d start with a travel capsule.`
    return {
      question: `${lead} Pick the trip mix${!profile.mission && !specificItemRequest ? ' and whether you want a full look or one hero piece' : ''}.`,
      groups,
      ctaLabel: 'Show my picks',
    }
  }

  if (warmDestination) {
    return {
      question: `I’d start with a warm-weather travel capsule. Pick the trip mix${!profile.mission && !specificItemRequest ? ' and whether you want a full look or one hero piece' : ''}.`,
      groups,
      ctaLabel: 'Show my picks',
    }
  }

  return {
    question: `I’d start with a travel capsule for the trip. Pick the trip mix${!profile.mission && !specificItemRequest ? ' and whether you want a full look or one hero piece' : ''}.`,
    groups,
    ctaLabel: 'Show my picks',
  }
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function buildMissionClarificationGroup(): ClarificationGroup {
  return {
    id: 'mission',
    label: 'Shop for',
    options: [
      {
        id: 'full_look',
        label: 'Full look',
        helper: 'Pull the outfit together end to end.',
        profilePatch: { mission: 'full_look' },
      },
      {
        id: 'hero_piece',
        label: 'Hero piece',
        helper: 'Start with the main item worth buying first.',
        profilePatch: { mission: 'hero_piece' },
      },
    ],
  }
}

function buildGenderClarificationGroup(): ClarificationGroup {
  return {
    id: 'gender',
    label: 'Shopping for',
    options: [
      {
        id: 'women',
        label: 'Women',
        helper: 'Shop women’s results.',
        profilePatch: { gender: 'women' },
      },
      {
        id: 'men',
        label: 'Men',
        helper: 'Shop men’s results.',
        profilePatch: { gender: 'men' },
      },
    ],
  }
}

function getUnsupportedShopperMessage(message: string | undefined) {
  if (!message) return null
  if (isUnsupportedShopperSegment(message)) {
    return 'I can shop women’s and men’s clothes right now. Tell me the adult brief and I’ll take it from there.'
  }
  return null
}

function getScopeGuardMessage(
  message: string | undefined,
  intentType: string,
  hasImage: boolean
) {
  if (hasImage || !message) return null
  if (intentType !== 'general_chat') return null
  if (isLikelyShoppingRelevant(message)) return null

  return 'I can help with clothes shopping only. Tell me the item, occasion, budget, size, or upload a look to shop.'
}

function buildBoardWarnings(
  profile: UserProfile,
  totalPrice: number,
  categories: string[],
  boardType: OutfitBoard['boardType']
) {
  const warnings: string[] = ['Stock can change quickly on retailer pages.']

  if (profile.size) {
    warnings.push('Clothing size is still advisory, so double-check retailer availability before buying.')
  }

  if (categories.some((category) => category === 'shoes' || category === 'footwear') && !profile.shoeSize) {
    warnings.push('You have not set a shoe size yet, so shoe picks are based on style rather than fit.')
  }

  const budgetCap = getBudgetCap(profile.budget, profile.budgetMax)
  if (budgetCap && totalPrice > budgetCap) {
    warnings.push(boardType === 'shortlist' ? 'Some picks in this shortlist sit over your stated budget.' : 'This board is over your stated budget.')
  }

  return warnings
}

function getBoardType(products: Product[]): OutfitBoard['boardType'] {
  if (products.length <= 1) return 'outfit'

  const categories = new Set(products.map((product) => normaliseCategory(product.category)))
  return categories.size <= 1 ? 'shortlist' : 'outfit'
}

function getBudgetReferenceTotal(products: Product[], boardType: OutfitBoard['boardType']) {
  if (products.length === 0) return 0

  if (boardType === 'shortlist') {
    return Math.max(...products.map((product) => product.price))
  }

  return products.reduce((sum, product) => sum + product.price, 0)
}

function normaliseCategory(category: string) {
  return category.trim().toLowerCase()
}

// ─── Simple extraction helpers ────────────────────────────────────────────────

function extractColours(text: string): string[] {
  const colours = ['black', 'white', 'grey', 'beige', 'cream', 'brown', 'navy', 'blue', 'green', 'red', 'pink', 'purple', 'yellow', 'orange', 'tan', 'camel', 'ecru', 'ivory']
  return colours.filter(c => text.toLowerCase().includes(c))
}

function extractCategories(text: string): string[] {
  const categories = ['blazer', 'jacket', 'coat', 'trousers', 'jeans', 'skirt', 'dress', 'top', 'shirt', 'blouse', 'shoes', 'boots', 'sneakers', 'trainers', 'heels', 'sandals', 'bag', 'accessories']
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
