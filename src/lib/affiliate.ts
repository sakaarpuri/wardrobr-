import { Product, SearchProductsParams, ProductSearchResult } from './types'

export class SearchProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SearchProviderUnavailableError'
  }
}

/**
 * Search for products via RapidAPI Real-Time Product Search first, then SerpApi.
 * Falls back to mock data only when explicitly allowed.
 */
export async function searchProducts(params: SearchProductsParams): Promise<ProductSearchResult> {
  const rapidApiHost = process.env.RAPIDAPI_HOST
  const rapidApiKey = process.env.RAPIDAPI_KEY
  const serpApiKey = process.env.SERPAPI_KEY
  const allowMockSearch = process.env.ALLOW_MOCK_SEARCH === 'true'

  if (rapidApiHost && rapidApiKey) {
    try {
      return await searchViaRapidApi(params, rapidApiHost, rapidApiKey)
    } catch (error) {
      if (!serpApiKey) {
        if (allowMockSearch) {
          console.warn('RapidAPI search failed, using mock search because ALLOW_MOCK_SEARCH=true', error)
          return getMockProducts(params)
        }

        if (error instanceof SearchProviderUnavailableError) {
          throw error
        }

        throw new SearchProviderUnavailableError(
          'RapidAPI product search failed. Check your RapidAPI credentials, subscription, or quota.'
        )
      }
    }
  }

  if (serpApiKey) {
    try {
      return await searchViaSerpApi(params, serpApiKey)
    } catch (error) {
      if (allowMockSearch) {
        console.warn('SerpApi search failed, using mock search because ALLOW_MOCK_SEARCH=true', error)
        return getMockProducts(params)
      }

      if (error instanceof SearchProviderUnavailableError) {
        throw error
      }

      throw new SearchProviderUnavailableError(
        'Live product search failed. Check your RapidAPI or SerpApi credentials, or set ALLOW_MOCK_SEARCH=true for demo mode.'
      )
    }
  }

  if (allowMockSearch) {
    console.warn('No live search provider configured, using mock search because ALLOW_MOCK_SEARCH=true')
    return getMockProducts(params)
  }

  throw new SearchProviderUnavailableError(
    'Live product search is unavailable. Add RapidAPI credentials, or re-enable SerpApi, or set ALLOW_MOCK_SEARCH=true for demo mode.'
  )
}

/**
 * Pass-through — affiliate rewriting handled by Sovrn/Skimlinks
 * once approved. Returns original URL for now.
 */
export async function rewriteAffiliateUrl(originalUrl: string): Promise<string> {
  return originalUrl
}

// ─── SerpApi Google Shopping ──────────────────────────────────────────────────

interface RapidApiProductOffer {
  offer_id?: string
  offer_page_url?: string
  price?: string
  original_price?: string | null
  store_name?: string
}

interface RapidApiProduct {
  product_id: string
  product_title: string
  product_description?: string
  product_photos?: string[]
  product_page_url?: string
  offer?: RapidApiProductOffer
}

interface RapidApiSearchResponse {
  status?: string
  data?: {
    products?: RapidApiProduct[]
  }
}

interface SerpApiShoppingResult {
  position: number
  title: string
  product_link: string   // direct product URL
  link?: string          // fallback
  serpapi_immersive_product_api?: string
  source: string
  price?: string
  extracted_price?: number
  thumbnail?: string
  thumbnails?: string[]  // additional product images
  rating?: number
  reviews?: number
  snippet?: string
}

interface SerpApiStoreResult {
  name?: string
  link?: string
}

interface SerpApiImmersiveResponse {
  product_results?: {
    brand?: string
    stores?: SerpApiStoreResult[]
  }
}

const immersiveUrlCache = new Map<string, Promise<{ productUrl: string | null; brand?: string }>>()

async function searchViaRapidApi(
  params: SearchProductsParams,
  host: string,
  apiKey: string
): Promise<ProductSearchResult> {
  let q = params.query
  if (params.gender) q = `${params.gender === 'men' ? "men's" : "women's"} ${q}`

  const searchParams = new URLSearchParams({
    q,
    country: (params.region ?? 'uk').toLowerCase(),
    language: 'en',
    page: '1',
    limit: String(Math.min(params.limit ?? 5, 10)),
    sort_by: 'BEST_MATCH',
    product_condition: 'ANY',
    return_filters: 'true',
  })
  if (params.minPrice) searchParams.set('min_price', String(params.minPrice))
  if (params.maxPrice) searchParams.set('max_price', String(params.maxPrice))

  const res = await fetch(`https://${host}/search-v2?${searchParams.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': host,
      'x-rapidapi-key': apiKey,
    },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    const message = await res.text()
    if (res.status === 429) {
      throw new SearchProviderUnavailableError('RapidAPI quota is exhausted. Top up the account or upgrade the plan.')
    }
    throw new SearchProviderUnavailableError(`RapidAPI returned ${res.status}. ${message}`)
  }

  const data = await res.json() as RapidApiSearchResponse
  const raw = data.data?.products ?? []

  const products = raw
    .map((product, index): Product | null => {
      const price = parsePriceValue(product.offer?.price)
      const productUrl = product.offer?.offer_page_url ?? product.product_page_url ?? ''
      const images = (product.product_photos ?? []).filter(Boolean)
      if (!price || !productUrl || images.length === 0) return null

      return {
        id: `rapid-${index}-${Date.now()}`,
        name: product.product_title,
        brand: guessBrand(product.product_title),
        price,
        currency: inferCurrency(product.offer?.price),
        imageUrl: images[0],
        images: images.length > 1 ? images : undefined,
        productUrl,
        affiliateUrl: productUrl,
        storeName: product.offer?.store_name ?? 'Unknown store',
        category: params.category ?? 'clothing',
        description: product.product_description,
      }
    })
    .filter((product): product is Product => Boolean(product))

  if (products.length === 0) {
    throw new SearchProviderUnavailableError(`RapidAPI returned no usable products for "${params.query}".`)
  }

  return { products, total: products.length, query: params.query }
}

async function searchViaSerpApi(params: SearchProductsParams, apiKey: string): Promise<ProductSearchResult> {
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
  if (!res.ok) {
    const message = await res.text()
    if (res.status === 429) {
      throw new SearchProviderUnavailableError('SerpApi quota is exhausted. Top up the account or switch to another search provider.')
    }
    throw new SearchProviderUnavailableError(`SerpApi returned ${res.status}. ${message}`)
  }

  const data = await res.json()
  const raw: SerpApiShoppingResult[] = data.shopping_results ?? []

  const products: Product[] = await Promise.all(
    raw
      .filter(r => r.thumbnail && r.extracted_price)
      .slice(0, params.limit ?? 5)
      .map(async (r, i) => {
        const resolved = await resolveMerchantProductUrl(r, apiKey)
        const productUrl = resolved.productUrl ?? r.product_link ?? r.link ?? ''
        const allImages = [
          ...(r.thumbnail ? [r.thumbnail] : []),
          ...(r.thumbnails ?? []),
        ].filter((img, idx, arr) => arr.indexOf(img) === idx)

        return {
          id: `serp-${i}-${Date.now()}`,
          name: r.title,
          brand: resolved.brand ?? r.source,
          price: r.extracted_price!,
          currency: 'GBP',
          imageUrl: allImages[0] ?? r.thumbnail!,
          images: allImages.length > 1 ? allImages : undefined,
          productUrl,
          affiliateUrl: productUrl,
          storeName: r.source,
          category: params.category ?? 'clothing',
          description: r.snippet,
        }
      })
  )

  if (products.length === 0) {
    throw new SearchProviderUnavailableError(`Live product search returned no results for "${params.query}".`)
  }

  return { products, total: products.length, query: params.query }
}

function isGoogleShoppingUrl(url: string | undefined) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('google.')
  } catch {
    return false
  }
}

function normaliseStoreName(name: string | undefined) {
  return (name ?? '')
    .toLowerCase()
    .replace(/\b(gb|uk)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function resolveMerchantProductUrl(
  result: SerpApiShoppingResult,
  apiKey: string
): Promise<{ productUrl: string | null; brand?: string }> {
  if (result.product_link && !isGoogleShoppingUrl(result.product_link)) {
    return { productUrl: result.product_link }
  }

  if (!result.serpapi_immersive_product_api) {
    return { productUrl: result.product_link ?? result.link ?? null }
  }

  const cacheKey = result.serpapi_immersive_product_api
  if (!immersiveUrlCache.has(cacheKey)) {
    immersiveUrlCache.set(cacheKey, fetchImmersiveProductUrl(result.serpapi_immersive_product_api, result.source, apiKey))
  }

  return immersiveUrlCache.get(cacheKey)!
}

async function fetchImmersiveProductUrl(
  immersiveApiUrl: string,
  source: string,
  apiKey: string
): Promise<{ productUrl: string | null; brand?: string }> {
  try {
    const detailUrl = new URL(immersiveApiUrl)
    detailUrl.searchParams.set('api_key', apiKey)
    const detail = await fetch(detailUrl.toString(), {
      next: { revalidate: 300 },
    }).then((response) => response.json() as Promise<SerpApiImmersiveResponse>)

    const stores = detail.product_results?.stores ?? []
    const sourceName = normaliseStoreName(source)
    const matchedStore =
      stores.find((store) => normaliseStoreName(store.name) === sourceName && store.link) ??
      stores.find((store) => normaliseStoreName(store.name).includes(sourceName) && store.link) ??
      stores.find((store) => store.link)

    return {
      productUrl: matchedStore?.link ?? null,
      brand: detail.product_results?.brand,
    }
  } catch (error) {
    console.error('Immersive product lookup failed:', error)
    return { productUrl: null }
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

function parsePriceValue(rawPrice: string | undefined) {
  if (!rawPrice) return null
  const numeric = Number(rawPrice.replace(/[^0-9.]+/g, ''))
  return Number.isFinite(numeric) ? numeric : null
}

function inferCurrency(rawPrice: string | undefined) {
  if (!rawPrice) return 'GBP'
  if (rawPrice.includes('£')) return 'GBP'
  if (rawPrice.includes('$')) return 'USD'
  if (rawPrice.includes('€')) return 'EUR'
  return 'GBP'
}

function guessBrand(title: string) {
  return title.split(/\s+/).find(Boolean) ?? 'Unknown'
}
