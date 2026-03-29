import { Product, SearchProductsParams, ProductSearchResult } from './types'

/**
 * Search for products via SerpApi Google Shopping (UK).
 * Falls back to mock data if SERPAPI_KEY is not set.
 */
export async function searchProducts(params: SearchProductsParams): Promise<ProductSearchResult> {
  const serpApiKey = process.env.SERPAPI_KEY

  if (serpApiKey) {
    return searchViaSerpApi(params, serpApiKey)
  }

  return getMockProducts(params)
}

/**
 * Pass-through — affiliate rewriting handled by Sovrn/Skimlinks
 * once approved. Returns original URL for now.
 */
export async function rewriteAffiliateUrl(originalUrl: string): Promise<string> {
  return originalUrl
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
  thumbnails?: string[]  // additional product images
  rating?: number
  reviews?: number
  snippet?: string
}

async function searchViaSerpApi(params: SearchProductsParams, apiKey: string): Promise<ProductSearchResult> {
  try {
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

    const products: Product[] = raw
      .filter(r => r.thumbnail && r.extracted_price)
      .slice(0, params.limit ?? 5)
      .map((r, i) => {
        const productUrl = r.product_link ?? r.link ?? ''
        const allImages = [
          ...(r.thumbnail ? [r.thumbnail] : []),
          ...(r.thumbnails ?? []),
        ].filter((img, idx, arr) => arr.indexOf(img) === idx)
        return {
          id: `serp-${i}-${Date.now()}`,
          name: r.title,
          brand: r.source,
          price: r.extracted_price!,
          currency: 'GBP',
          imageUrl: allImages[0] ?? r.thumbnail!,
          images: allImages.length > 1 ? allImages : undefined,
          productUrl,
          affiliateUrl: productUrl,  // direct link — Sovrn JS will rewrite on click once approved
          storeName: r.source,
          category: params.category ?? 'clothing',
          description: r.snippet,
        }
      })

    return { products, total: products.length, query: params.query }
  } catch (error) {
    console.error('SerpApi error:', error)
    return getMockProducts(params)
  }
}

// ─── Mock data (fallback when SERPAPI_KEY not set) ────────────────────────────

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
  return {
    products: results.slice(0, params.limit ?? 5),
    total: results.length,
    query: params.query,
  }
}
