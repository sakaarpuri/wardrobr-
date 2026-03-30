import { NextRequest, NextResponse } from 'next/server'
import { searchProducts, rewriteAffiliateUrl } from '@/lib/affiliate'
import { UserProfile, getSearchPriceCap, normaliseUserProfile } from '@/lib/shopper'
import { buildProtectedSearchQuery, constrainProductsToProtectedAttributes, extractProtectedAttributesFromProduct, extractProtectedAttributesFromText, mergeProtectedAttributes } from '@/lib/product-attributes'
import { buildDecisionReadyProducts, detectRequestedBrand } from '@/lib/decision-assist'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      category,
      occasionContext,
      action = 'same_vibe',
      currentPrice,
      currentStore,
      productName,
      currentProductDescription,
      refinementText,
      profile: rawProfile,
    } = body as {
      productId?: string
      productName?: string
      currentProductDescription?: string
      category?: string
      occasionContext?: string
      action?: string
      currentPrice?: number
      currentStore?: string
      refinementText?: string
      profile?: Partial<UserProfile>
    }
    const profile = normaliseUserProfile(rawProfile)

    if (!category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 })
    }

    const protectedAttributes = mergeProtectedAttributes(
      extractProtectedAttributesFromText(refinementText ?? ''),
      extractProtectedAttributesFromProduct({
        name: productName ?? '',
        description: currentProductDescription,
        category: category ?? '',
      })
    )

    const { query, actionLabel, maxPrice } = buildSwapQuery({
      action,
      category,
      occasionContext,
      currentStore,
      currentPrice,
      protectedQuery: buildProtectedSearchQuery('', protectedAttributes).trim(),
    })

    const result = await searchProducts({
      query,
      category,
      limit: 5,
      gender: profile.gender ?? undefined,
      maxPrice: maxPrice ?? getSearchPriceCap(profile) ?? undefined,
    })
    const constrained = constrainProductsToProtectedAttributes(result.products, protectedAttributes)
    const decisionReady = buildDecisionReadyProducts({
      products: constrained.products,
      requestText: `${occasionContext ?? ''} ${refinementText ?? ''}`.trim(),
      budgetCap: getSearchPriceCap(profile) ?? undefined,
      requestedBrand: detectRequestedBrand(`${occasionContext ?? ''} ${refinementText ?? ''}`),
      protectedAttributes,
    })

    // Rewrite affiliate URLs server-side before returning to client
    const alternatives = await Promise.all(
      decisionReady.products
        .filter((p) => p.name !== productName)
        .slice(0, 3)
        .map(async (p) => ({
        ...p,
        affiliateUrl: await rewriteAffiliateUrl(p.productUrl),
      }))
    )

    return NextResponse.json({ alternatives, actionLabel, notice: constrained.disclosure })
  } catch (error) {
    console.error('Swap API error:', error)
    return NextResponse.json({ error: 'Failed to find alternatives' }, { status: 500 })
  }
}

function buildSwapQuery(params: {
  action: string
  category: string
  occasionContext?: string
  currentStore?: string
  currentPrice?: number
  protectedQuery?: string
}) {
  const { action, category, occasionContext, currentStore, currentPrice, protectedQuery } = params
  const context = occasionContext ? ` for ${occasionContext}` : ''
  const protection = protectedQuery ? ` ${protectedQuery}` : ''

  if (action === 'cheaper') {
    return {
      query: `cheaper ${category}${protection}${context}`,
      actionLabel: 'cheaper',
      maxPrice: currentPrice ? Math.max(10, Math.floor(currentPrice * 0.85)) : undefined,
    }
  }

  if (action === 'dressier') {
    return { query: `dressier ${category}${protection}${context}`, actionLabel: 'dressier', maxPrice: undefined }
  }

  if (action === 'more_casual') {
    return { query: `more casual ${category}${protection}${context}`, actionLabel: 'more casual', maxPrice: undefined }
  }

  if (action === 'different_store') {
    return {
      query: `${category}${protection}${context} from a different retailer than ${currentStore ?? 'the current store'}`,
      actionLabel: 'different-store',
      maxPrice: undefined,
    }
  }

  if (action === 'flats_instead') {
    return { query: `flat ${category}${protection}${context}`, actionLabel: 'flatter', maxPrice: undefined }
  }

  if (action === 'different_colour') {
    return { query: `${category}${protection} in a different colour${context}`, actionLabel: 'different-colour', maxPrice: undefined }
  }

  return { query: `${category}${protection}${context}`, actionLabel: 'new', maxPrice: undefined }
}
