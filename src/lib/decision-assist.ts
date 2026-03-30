import type { OutfitBoard, Product } from './types'
import { formatCurrency } from './shopper'
import type { ProtectedProductAttributes } from './product-attributes'

type PriceTier = 'value' | 'mid' | 'premium' | 'luxury'

interface BrandProfile {
  canonical: string
  aliases: string[]
  styleTags: string[]
  priceTier: PriceTier
  compareLine?: string
  fitLine?: string
  similarStores: string[]
}

const BRAND_PROFILES: BrandProfile[] = [
  {
    canonical: 'Uniqlo',
    aliases: ['uniqlo'],
    styleTags: ['clean', 'minimal', 'basic', 'functional', 'everyday'],
    priceTier: 'mid',
    compareLine: "Closest to Uniqlo's clean basics.",
    fitLine: 'Usually cleaner and more straightforward than trend-led high street basics.',
    similarStores: ['uniqlo', 'cos', 'arket', 'marks and spencer', 'm&s', 'weekday'],
  },
  {
    canonical: 'COS',
    aliases: ['cos'],
    styleTags: ['minimal', 'architectural', 'clean', 'tailored', 'premium'],
    priceTier: 'premium',
    compareLine: "Closest to COS' cleaner minimal feel.",
    fitLine: 'Often reads cleaner and more tailored than mainstream high street picks.',
    similarStores: ['cos', 'arket', 'massimo dutti', '& other stories'],
  },
  {
    canonical: 'Zara',
    aliases: ['zara'],
    styleTags: ['trend', 'sleek', 'dressy', 'fashion', 'high-street'],
    priceTier: 'mid',
    compareLine: "Closest to Zara's sharper high-street look.",
    fitLine: 'Can lean slimmer and more trend-led than Uniqlo or M&S basics.',
    similarStores: ['zara', 'mango', 'massimo dutti', 'h&m'],
  },
  {
    canonical: 'M&S',
    aliases: ['marks and spencer', 'm&s', 'marks & spencer'],
    styleTags: ['classic', 'reliable', 'clean', 'practical'],
    priceTier: 'mid',
    compareLine: "Closest to M&S' cleaner everyday basics.",
    fitLine: 'Often a safer bet if you like a little more room through the body.',
    similarStores: ['marks and spencer', 'm&s', 'next', 'john lewis'],
  },
]

const CATEGORY_GUIDANCE: Array<{ match: RegExp; note: string }> = [
  { match: /\b(trainers|sneakers|walking|city break|day trip)\b/, note: 'Best for all-day walking.' },
  { match: /\b(blazer|jacket|leather|loafer|heel|smart|dressier)\b/, note: 'Cleaner and easier to dress up.' },
  { match: /\b(basic|minimal|everyday|capsule)\b/, note: 'Lowest-risk pick if you want a dependable wardrobe basic.' },
]

const QUALITY_CUES = ['leather', 'wool', 'tailored', 'premium', 'suede', 'grain', 'structured']
const WALKING_CUES = ['comfort', 'walking', 'cushion', 'support', 'trainer', 'sneaker']

function normalise(text?: string | null) {
  return text?.toLowerCase().trim() ?? ''
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}

function getPriceTierFromPrice(price: number): PriceTier {
  if (price >= 220) return 'luxury'
  if (price >= 110) return 'premium'
  if (price >= 45) return 'mid'
  return 'value'
}

function getBrandProfileByName(value?: string | null) {
  const lowered = normalise(value)
  if (!lowered) return null

  return BRAND_PROFILES.find((profile) =>
    profile.aliases.some((alias) => lowered.includes(alias))
  ) ?? null
}

function getProductText(product: Product) {
  return normalise([product.name, product.brand, product.storeName, product.description, product.category].filter(Boolean).join(' '))
}

function hasRequestedBrand(products: Product[], requestedBrand: string) {
  const lowered = normalise(requestedBrand)
  return products.some((product) => {
    const productText = getProductText(product)
    return productText.includes(lowered)
  })
}

function getDecisionCue(product: Product, requestText: string) {
  const haystack = `${getProductText(product)} ${normalise(requestText)}`

  for (const entry of CATEGORY_GUIDANCE) {
    if (entry.match.test(haystack)) {
      return entry.note
    }
  }

  if (QUALITY_CUES.some((cue) => haystack.includes(cue))) {
    return 'Feels like the stronger quality-leaning option in this shortlist.'
  }

  return 'Strong, low-friction option to compare first.'
}

function getWatchout(product: Product, minPrice: number, maxPrice: number) {
  const haystack = getProductText(product)

  if (maxPrice > minPrice && product.price >= minPrice + (maxPrice - minPrice) * 0.7) {
    return 'Pricier than the rest of this shortlist.'
  }

  if (haystack.includes('slim fit') || haystack.includes('fitted')) {
    return 'Worth checking size if you prefer a little room.'
  }

  return null
}

function getFitGuidance(product: Product, requestedBrand?: string | null) {
  const productProfile = getBrandProfileByName(`${product.brand} ${product.storeName}`)
  const requestedProfile = requestedBrand ? getBrandProfileByName(requestedBrand) : null

  if (requestedProfile && productProfile && requestedProfile.canonical !== productProfile.canonical && productProfile.fitLine) {
    return {
      text: productProfile.fitLine,
      confidence: 'low' as const,
      source: 'brand_map' as const,
    }
  }

  if (productProfile?.fitLine) {
    return {
      text: productProfile.fitLine,
      confidence: 'low' as const,
      source: 'brand_map' as const,
    }
  }

  return undefined
}

function scoreBrandSimilarity(product: Product, requestedProfile: BrandProfile | null) {
  if (!requestedProfile) return 0

  const haystack = getProductText(product)
  const productTier = getPriceTierFromPrice(product.price)
  let score = 0

  if (requestedProfile.similarStores.some((store) => haystack.includes(store))) score += 4
  if (requestedProfile.styleTags.some((tag) => haystack.includes(tag))) score += 2
  if (requestedProfile.priceTier === productTier) score += 2
  if (requestedProfile.priceTier === 'mid' && productTier === 'value') score += 1

  return score
}

function scoreQuality(product: Product) {
  const haystack = getProductText(product)
  return QUALITY_CUES.reduce((score, cue) => score + (haystack.includes(cue) ? 1 : 0), 0)
}

function scoreWalking(product: Product) {
  const haystack = getProductText(product)
  return WALKING_CUES.reduce((score, cue) => score + (haystack.includes(cue) ? 1 : 0), 0)
}

export function detectRequestedBrand(text?: string | null) {
  const lowered = normalise(text)
  if (!lowered) return null

  const match = BRAND_PROFILES.find((profile) =>
    profile.aliases.some((alias) => new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`).test(lowered))
  )

  return match?.canonical ?? null
}

export function buildDecisionReadyProducts(params: {
  products: Product[]
  requestText?: string | null
  budgetCap?: number | null
  requestedBrand?: string | null
  protectedAttributes?: ProtectedProductAttributes
}) {
  const { products, requestText = '', budgetCap = null, requestedBrand = null, protectedAttributes } = params
  const safeRequestText = requestText ?? ''

  if (products.length === 0) {
    return {
      products,
      brandSubstitutionNote: null as string | null,
      bestOverallProductId: null as string | null,
      bestBudgetProductId: null as string | null,
      closestBrandMatchProductId: null as string | null,
    }
  }

  const requestedProfile = requestedBrand ? getBrandProfileByName(requestedBrand) : null
  const exactBrandAvailable = requestedBrand ? hasRequestedBrand(products, requestedBrand) : false
  const minPrice = Math.min(...products.map((product) => product.price))
  const maxPrice = Math.max(...products.map((product) => product.price))

  const productsWithScores = products.map((product) => {
    const brandSimilarity = !exactBrandAvailable ? scoreBrandSimilarity(product, requestedProfile) : 0
    const qualityScore = scoreQuality(product)
    const walkingScore = scoreWalking(product)
    const underBudgetBonus = budgetCap && product.price <= budgetCap ? 1.5 : 0
    const overallScore = brandSimilarity + qualityScore + underBudgetBonus - (product.price / Math.max(maxPrice, 1)) * 0.8

    return {
      product,
      brandSimilarity,
      qualityScore,
      walkingScore,
      overallScore,
    }
  })

  const bestOverall = [...productsWithScores].sort((a, b) => b.overallScore - a.overallScore)[0]?.product ?? null
  const bestBudget = [...productsWithScores].sort((a, b) => a.product.price - b.product.price)[0]?.product ?? null
  const closestBrand = !exactBrandAvailable
    ? [...productsWithScores].sort((a, b) => b.brandSimilarity - a.brandSimilarity || a.product.price - b.product.price)[0]?.product ?? null
    : null

  const brandSubstitutionNote =
    requestedBrand && !exactBrandAvailable
      ? `I couldn't get ${requestedBrand} itself here, so I pulled the closest available options for that same ${requestedProfile?.styleTags.slice(0, 2).join(', ') ?? 'overall'} feel.`
      : null

  const rankedProducts = [...productsWithScores].sort((a, b) => {
    if (closestBrand && a.product.id === closestBrand.id) return -1
    if (closestBrand && b.product.id === closestBrand.id) return 1
    if (bestOverall && a.product.id === bestOverall.id) return -1
    if (bestOverall && b.product.id === bestOverall.id) return 1
    return a.product.price - b.product.price
  })

  return {
    products: rankedProducts.map(({ product, walkingScore, qualityScore }) => {
      const badges = uniqueStrings([
        product.id === bestOverall?.id ? 'Best overall' : null,
        product.id === bestBudget?.id ? 'Best under budget' : null,
        product.id === closestBrand?.id ? `Closest to ${requestedBrand}` : null,
        walkingScore > 0 ? 'Best for walking' : null,
        qualityScore >= 2 ? 'Best quality feel' : null,
      ])

      const fitGuidance = getFitGuidance(product, requestedBrand)
      const watchout = getWatchout(product, minPrice, maxPrice)
      const protectedLane = [protectedAttributes?.material?.replace('_', ' '), protectedAttributes?.finish]
        .filter((value): value is string => Boolean(value))
        .join(' / ')

      return {
        ...product,
        decisionNote: product.id === closestBrand?.id && requestedProfile?.compareLine
          ? requestedProfile.compareLine
          : protectedLane
          ? `${getDecisionCue(product, safeRequestText)} Keeping the requested ${protectedLane} lane where possible.`
          : getDecisionCue(product, safeRequestText),
        watchoutNote: watchout ?? undefined,
        brandSubstitutionNote: product.id === closestBrand?.id && brandSubstitutionNote ? `Closest available to ${requestedBrand}.` : undefined,
        fitGuidance,
        decisionBadges: badges.length > 0 ? badges : undefined,
      }
    }),
    brandSubstitutionNote,
    bestOverallProductId: bestOverall?.id ?? null,
    bestBudgetProductId: bestBudget?.id ?? null,
    closestBrandMatchProductId: closestBrand?.id ?? null,
  }
}

export function buildBoardQuickRefineActions(params: {
  board: Pick<OutfitBoard, 'products' | 'boardType' | 'brandRequest'>
  requestedBrand?: string | null
  protectedAttributes?: ProtectedProductAttributes
}) {
  const { board, requestedBrand = null, protectedAttributes } = params
  const categories = uniqueStrings(board.products.map((product) => normalise(product.category)))
  const isShoes = categories.some((category) => ['shoes', 'footwear', 'trainers', 'sneakers', 'boots'].includes(category))
  const hasLeather = board.products.some((product) => /\bleather\b/.test(getProductText(product)))

  const actions: Array<{ label: string; prompt: string }> = [
    {
      label: 'Cheaper',
      prompt: 'Show me the cheaper options from this shortlist.',
    },
  ]

  if (hasLeather || protectedAttributes?.finish || protectedAttributes?.material) {
    actions.push(
      { label: 'Cleaner', prompt: 'Show me the cleaner, less busy options from this shortlist.' },
      { label: 'Less shiny', prompt: 'Keep the same material, but show me the less shiny options from this shortlist.' },
    )
  }

  if (requestedBrand) {
    actions.push({
      label: `Most like ${requestedBrand}`,
      prompt: `Show me the option that feels most like ${requestedBrand}.`,
    })
  }

  if (isShoes) {
    actions.push({
      label: 'Best for walking',
      prompt: 'Show me the strongest option here for all-day walking.',
    })
  }

  actions.push({
    label: 'Best quality feel',
    prompt: 'Show me the strongest quality-feeling option from this shortlist.',
  })

  return actions.slice(0, 5)
}

export function buildBoardLeadNote(board: OutfitBoard) {
  if (board.brandSubstitutionNote) return board.brandSubstitutionNote

  if (board.boardType === 'shortlist' && board.bestOverallProductId && board.products.length > 1) {
    const bestProduct = board.products.find((product) => product.id === board.bestOverallProductId)
    if (bestProduct) {
      return `${bestProduct.name} is the cleanest place to start, then use the shortlist to compare price, finish, and store.`
    }
  }

  return board.styleNote ?? null
}

export function getBudgetHelperLine(board: OutfitBoard) {
  if (board.boardType !== 'shortlist' || board.budgetRemaining === null || board.budgetRemaining === undefined) {
    return null
  }

  if (board.budgetRemaining >= 0) {
    return `Most expensive pick still leaves ${formatCurrency(board.budgetRemaining)} headroom.`
  }

  return `Most expensive pick is ${formatCurrency(Math.abs(board.budgetRemaining))} over budget.`
}
