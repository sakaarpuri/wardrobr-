import type { OutfitBoard, Product } from './types'

export type ProductHandoffKind = 'cart' | 'product'
export type BoardHandoffKind = 'cart' | 'single_store' | 'tabs'
export type ProductHandoffCapability = 'cart_supported' | 'variant_selectable' | 'single_store_groupable' | 'pdp_only'

export interface ProductHandoff {
  kind: ProductHandoffKind
  url: string
  storeName: string
  platform: 'shopify' | 'woocommerce' | 'generic'
  capability: ProductHandoffCapability
  label: string
  reason: string
}

export interface BoardHandoffPlan {
  kind: BoardHandoffKind
  label: string
  description: string
  urls: string[]
  singleUrl?: string
  storeName?: string
  capability: ProductHandoffCapability | 'mixed'
}

function safeUrl(rawUrl: string | undefined) {
  if (!rawUrl) return null
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

function getBaseProductUrl(product: Product) {
  return product.affiliateUrl || product.productUrl
}

function isLikelyShopifyProductUrl(url: URL) {
  return url.pathname.includes('/products/') && /^\d+$/.test(url.searchParams.get('variant') ?? '')
}

function getShopifyVariantId(url: URL) {
  const variantId = url.searchParams.get('variant')?.trim() ?? ''
  return /^\d+$/.test(variantId) ? variantId : null
}

function buildShopifyCartUrl(url: URL, variantId: string) {
  return `${url.origin}/cart/${variantId}:1`
}

function isWooCommerceCartUrl(url: URL) {
  const addToCart = url.searchParams.get('add-to-cart')?.trim() ?? ''
  return /^\d+$/.test(addToCart)
}

function normaliseStoreName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getStoreGroupKey(product: Product) {
  const url = safeUrl(getBaseProductUrl(product))
  if (!url) return normaliseStoreName(product.storeName)
  return `${normaliseStoreName(product.storeName)}::${url.origin}`
}

export function getProductHandoff(product: Product): ProductHandoff {
  const rawUrl = getBaseProductUrl(product)
  const parsed = safeUrl(rawUrl)

  if (!parsed || !rawUrl) {
    return {
      kind: 'product',
      url: product.productUrl,
      storeName: product.storeName,
      platform: 'generic',
      capability: 'pdp_only',
      label: 'Open product page',
      reason: 'Best available link is the product page for this item.',
    }
  }

  if (isLikelyShopifyProductUrl(parsed)) {
    const variantId = getShopifyVariantId(parsed)
    if (variantId) {
      return {
        kind: 'cart',
        url: buildShopifyCartUrl(parsed, variantId),
        storeName: product.storeName,
        platform: 'shopify',
        capability: 'cart_supported',
        label: `Cart ready at ${product.storeName}`,
        reason: 'This item supports a direct cart handoff.',
      }
    }

    return {
      kind: 'product',
      url: rawUrl,
      storeName: product.storeName,
      platform: 'shopify',
      capability: 'variant_selectable',
      label: 'Open product page',
      reason: 'Best available link is the product page, with merchant-side variant selection.',
    }
  }

  if (isWooCommerceCartUrl(parsed)) {
    return {
      kind: 'cart',
      url: parsed.toString(),
      storeName: product.storeName,
      platform: 'woocommerce',
      capability: 'cart_supported',
      label: `Cart ready at ${product.storeName}`,
      reason: 'This store supports add-to-cart links for this product.',
    }
  }

  return {
    kind: 'product',
    url: rawUrl,
    storeName: product.storeName,
    platform: 'generic',
    capability: 'pdp_only',
    label: 'Open product page',
    reason: 'Best available link is the product page for this item.',
  }
}

export function getBoardHandoffPlan(board: OutfitBoard): BoardHandoffPlan {
  const handoffs = board.products.map((product) => ({
    product,
    handoff: getProductHandoff(product),
  }))

  const shopifyCandidates = handoffs.filter(({ handoff, product }) => {
    const url = safeUrl(getBaseProductUrl(product))
    const variantId = url ? getShopifyVariantId(url) : null
    return handoff.platform === 'shopify' && handoff.kind === 'cart' && Boolean(variantId) && Boolean(url)
  })

  const uniqueStoreKeys = new Set(board.products.map(getStoreGroupKey))

  if (shopifyCandidates.length === board.products.length && handoffs.length > 0 && uniqueStoreKeys.size === 1) {
    const firstUrl = safeUrl(getBaseProductUrl(shopifyCandidates[0].product))
    if (firstUrl) {
      const variants = shopifyCandidates
        .map(({ product }) => {
          const productUrl = safeUrl(getBaseProductUrl(product))
          const variantId = productUrl ? getShopifyVariantId(productUrl) : null
          return variantId ? `${variantId}:1` : null
        })
        .filter((value): value is string => Boolean(value))

      if (variants.length === board.products.length) {
        return {
          kind: 'cart',
          label: `Add look to cart at ${board.products[0].storeName}`,
          description: 'We can prefill one merchant cart for this whole look.',
          singleUrl: `${firstUrl.origin}/cart/${variants.join(',')}`,
          urls: handoffs.map(({ handoff }) => handoff.url),
          storeName: board.products[0].storeName,
          capability: 'cart_supported',
        }
      }
    }
  }

  if (uniqueStoreKeys.size === 1 && handoffs.length > 0) {
    return {
      kind: 'single_store',
      label: `Shop this look at ${board.products[0].storeName}`,
      description: 'Everything in this board comes from one store.',
      urls: handoffs.map(({ handoff }) => handoff.url),
      storeName: board.products[0].storeName,
      capability: 'single_store_groupable',
    }
  }

  return {
    kind: 'tabs',
    label: 'Open results in tabs',
    description: 'We will use cart links where supported, and product pages for the rest.',
    urls: handoffs.map(({ handoff }) => handoff.url),
    capability: 'mixed',
  }
}
