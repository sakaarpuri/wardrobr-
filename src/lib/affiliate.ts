import { Product, SearchProductsParams, ProductSearchResult } from './types'
import crypto from 'crypto'

const SKIMLINKS_API_BASE = 'https://api.skimlinks.com'
const SKIMLINKS_LINK_API = 'https://go.skimlinks.com/api.php'

/**
 * Rewrite a product URL through Skimlinks affiliate tracking.
 * IMPORTANT: This must always be called server-side, never client-side.
 */
export async function rewriteAffiliateUrl(originalUrl: string): Promise<string> {
  const publisherId = process.env.SKIMLINKS_PUBLISHER_ID
  const apiKey = process.env.SKIMLINKS_API_KEY

  if (!publisherId || !apiKey) {
    // Return original URL if not configured (dev mode)
    return originalUrl
  }

  try {
    const params = new URLSearchParams({
      url: originalUrl,
      pub: publisherId,
    })
    const response = await fetch(`${SKIMLINKS_LINK_API}?${params}`, {
      headers: { 'X-Skimlinks-API-Key': apiKey },
    })

    if (!response.ok) return originalUrl

    const data = await response.json()
    return data.affUrl || originalUrl
  } catch {
    return originalUrl
  }
}

/**
 * Search for products. Priority:
 * 1. Skimlinks (if SKIMLINKS_API_KEY set)
 * 2. SerpApi Google Shopping (if SERPAPI_KEY set)
 * 3. Mock data (dev fallback)
 */
export async function searchProducts(params: SearchProductsParams): Promise<ProductSearchResult> {
  const skimlinkKey = process.env.SKIMLINKS_API_KEY
  const skimlinkPub = process.env.SKIMLINKS_PUBLISHER_ID
  const serpApiKey = process.env.SERPAPI_KEY

  // 1. Skimlinks
  if (skimlinkKey && skimlinkPub) {
    try {
      const searchParams = new URLSearchParams({
        query: params.query,
        country: 'GB',
        currency: 'GBP',
        limit: String(params.limit ?? 5),
      })
      if (params.category) searchParams.set('category', params.category)
      if (params.minPrice) searchParams.set('min_price', String(params.minPrice))
      if (params.maxPrice) searchParams.set('max_price', String(params.maxPrice))
      if (params.gender) searchParams.set('gender', params.gender)

      const response = await fetch(`${SKIMLINKS_API_BASE}/products/search?${searchParams}`, {
        headers: {
          'X-Skimlinks-API-Key': skimlinkKey,
          'X-Skimlinks-Publisher-ID': skimlinkPub,
        },
        next: { revalidate: 300 },
      })
      if (!response.ok) throw new Error(`Skimlinks ${response.status}`)
      const data = await response.json()
      const products = await Promise.all(
        (data.products || []).map(async (item: SkimlinkProduct) => mapSkimlinkProduct(item, skimlinkPub))
      )
      return { products, total: data.total ?? products.length, query: params.query }
    } catch (error) {
      console.error('Skimlinks error, falling through:', error)
    }
  }

  // 2. SerpApi Google Shopping
  if (serpApiKey) {
    return searchViaSerpApi(params, serpApiKey)
  }

  // 3. Mock data
  return getMockProducts(params)
}

// ─── SerpApi Google Shopping ──────────────────────────────────────────────────

interface SerpApiShoppingResult {
  position: number
  title: string
  product_link: string   // direct product URL
  link?: string          // fallback
  source: string
  price?: string
  extracted_price?: number
  thumbnail?: string
  rating?: number
  reviews?: number
  snippet?: string
}

async function searchViaSerpApi(params: SearchProductsParams, apiKey: string): Promise<ProductSearchResult> {
  try {
    // Build a focused query
    let q = params.query
    if (params.gender) q = `${params.gender === 'men' ? "men's" : "women's"} ${q}`

    const searchParams = new URLSearchParams({
      engine: 'google_shopping',
      q,
      google_domain: 'google.co.uk',  // UK Google domain → UK retailers
      gl: 'uk',                        // United Kingdom
      hl: 'en',
      api_key: apiKey,
    })
    if (params.minPrice) searchParams.set('min_price', String(params.minPrice))
    if (params.maxPrice) searchParams.set('max_price', String(params.maxPrice))

    const res = await fetch(`https://serpapi.com/search?${searchParams}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`SerpApi ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const raw: SerpApiShoppingResult[] = data.shopping_results ?? []

    const products: Product[] = await Promise.all(
      raw
        .filter(r => r.thumbnail && r.extracted_price)
        .slice(0, params.limit ?? 5)
        .map(async (r, i) => {
          const productUrl = r.product_link ?? r.link ?? ''
          const affiliateUrl = await rewriteAffiliateUrl(productUrl)
          return {
            id: `serp-${i}-${Date.now()}`,
            name: r.title,
            brand: r.source,
            price: r.extracted_price!,
            currency: 'GBP',
            imageUrl: r.thumbnail!,
            productUrl,
            affiliateUrl,
            storeName: r.source,
            category: params.category ?? 'clothing',
            description: r.snippet,
          }
        })
    )

    return { products, total: products.length, query: params.query }
  } catch (error) {
    console.error('SerpApi error:', error)
    return getMockProducts(params)
  }
}

interface SkimlinkProduct {
  id: string
  name: string
  brand: string
  price: number
  currency: string
  imageUrl: string
  url: string
  merchant: string
  category: string
  description?: string
}

async function mapSkimlinkProduct(item: SkimlinkProduct, publisherId: string): Promise<Product> {
  const affiliateUrl = await rewriteAffiliateUrl(item.url)
  return {
    id: item.id ?? crypto.randomUUID(),
    name: item.name,
    brand: item.brand ?? 'Unknown',
    price: item.price,
    currency: item.currency ?? 'GBP',
    imageUrl: item.imageUrl,
    productUrl: item.url,
    affiliateUrl,
    storeName: item.merchant,
    category: item.category ?? 'clothing',
    description: item.description,
  }
}

// ─── Mock data for development ────────────────────────────────────────────────

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'mock-1',
    name: 'Oversized Linen Blazer',
    brand: 'ASOS',
    price: 55,
    currency: 'GBP',
    imageUrl: 'https://images.asos-media.com/products/asos-design-oversized-linen-blazer/mock1',
    productUrl: 'https://www.asos.com/asos-design/mock1',
    affiliateUrl: 'https://www.asos.com/asos-design/mock1',
    storeName: 'ASOS',
    category: 'outerwear',
    description: 'Relaxed fit linen blazer in natural beige',
    aiExplanation: 'The anchor piece of the look — structured enough to elevate, relaxed enough to feel effortless.',
  },
  {
    id: 'mock-2',
    name: 'Wide Leg Linen Trousers',
    brand: 'H&M',
    price: 29.99,
    currency: 'GBP',
    imageUrl: 'https://lp2.hm.com/hmgoepprod/mock2',
    productUrl: 'https://www2.hm.com/en_gb/mock2',
    affiliateUrl: 'https://www2.hm.com/en_gb/mock2',
    storeName: 'H&M',
    category: 'bottoms',
    description: 'High-waisted wide leg trousers in ecru',
    aiExplanation: 'These wide-leg trousers balance the blazer perfectly — the matching linen creates a tonal co-ord effect.',
  },
  {
    id: 'mock-3',
    name: 'Fitted Ribbed Tank Top',
    brand: 'Zara',
    price: 15.99,
    currency: 'GBP',
    imageUrl: 'https://static.zara.net/photos/mock3',
    productUrl: 'https://www.zara.com/gb/mock3',
    affiliateUrl: 'https://www.zara.com/gb/mock3',
    storeName: 'Zara',
    category: 'tops',
    description: 'Seamless ribbed tank in white',
    aiExplanation: 'A clean white base keeps the layering fresh and lets the blazer do the talking.',
  },
  {
    id: 'mock-4',
    name: 'Leather Strappy Sandals',
    brand: 'Office',
    price: 65,
    currency: 'GBP',
    imageUrl: 'https://media.office.co.uk/mock4',
    productUrl: 'https://www.office.co.uk/mock4',
    affiliateUrl: 'https://www.office.co.uk/mock4',
    storeName: 'Office',
    category: 'shoes',
    description: 'Tan leather strappy flat sandals',
    aiExplanation: 'Simple tan sandals ground the outfit without competing with the linen palette.',
  },
  {
    id: 'mock-5',
    name: 'Structured Mini Tote',
    brand: 'Whistles',
    price: 89,
    currency: 'GBP',
    imageUrl: 'https://whistles.scene7.com/mock5',
    productUrl: 'https://www.whistles.com/mock5',
    affiliateUrl: 'https://www.whistles.com/mock5',
    storeName: 'Whistles',
    category: 'bags',
    description: 'Cream structured leather tote bag',
    aiExplanation: 'This mini tote adds quiet luxury — the cream leather echoes the linen tones throughout.',
  },
]

function getMockProducts(params: SearchProductsParams): ProductSearchResult {
  const filtered = MOCK_PRODUCTS.filter(p => {
    if (params.category && p.category !== params.category) return false
    if (params.minPrice && p.price < params.minPrice) return false
    if (params.maxPrice && p.price > params.maxPrice) return false
    return true
  })

  const results = filtered.length > 0 ? filtered : MOCK_PRODUCTS
  const limit = params.limit ?? 5

  return {
    products: results.slice(0, limit),
    total: results.length,
    query: params.query,
  }
}
