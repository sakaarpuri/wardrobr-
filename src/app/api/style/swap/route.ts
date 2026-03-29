import { NextRequest, NextResponse } from 'next/server'
import { searchProducts, rewriteAffiliateUrl } from '@/lib/affiliate'
import { UserProfile, getSearchPriceCap, normaliseUserProfile } from '@/lib/shopper'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { category, occasionContext, action = 'same_vibe', currentPrice, currentStore, productName, profile: rawProfile } = body as {
      productId?: string
      productName?: string
      category?: string
      occasionContext?: string
      action?: string
      currentPrice?: number
      currentStore?: string
      profile?: Partial<UserProfile>
    }
    const profile = normaliseUserProfile(rawProfile)

    if (!category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 })
    }

    const { query, actionLabel, maxPrice } = buildSwapQuery({
      action,
      category,
      occasionContext,
      currentStore,
      currentPrice,
    })

    const result = await searchProducts({
      query,
      category,
      limit: 5,
      gender: profile.gender ?? undefined,
      maxPrice: maxPrice ?? getSearchPriceCap(profile) ?? undefined,
    })

    // Rewrite affiliate URLs server-side before returning to client
    const alternatives = await Promise.all(
      result.products
        .filter((p) => p.name !== productName)
        .slice(0, 3)
        .map(async (p) => ({
        ...p,
        affiliateUrl: await rewriteAffiliateUrl(p.productUrl),
      }))
    )

    return NextResponse.json({ alternatives, actionLabel })
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
}) {
  const { action, category, occasionContext, currentStore, currentPrice } = params
  const context = occasionContext ? ` for ${occasionContext}` : ''

  if (action === 'cheaper') {
    return {
      query: `cheaper ${category}${context}`,
      actionLabel: 'cheaper',
      maxPrice: currentPrice ? Math.max(10, Math.floor(currentPrice * 0.85)) : undefined,
    }
  }

  if (action === 'dressier') {
    return { query: `dressier ${category}${context}`, actionLabel: 'dressier', maxPrice: undefined }
  }

  if (action === 'more_casual') {
    return { query: `more casual ${category}${context}`, actionLabel: 'more casual', maxPrice: undefined }
  }

  if (action === 'different_store') {
    return {
      query: `${category}${context} from a different retailer than ${currentStore ?? 'the current store'}`,
      actionLabel: 'different-store',
      maxPrice: undefined,
    }
  }

  if (action === 'flats_instead') {
    return { query: `flat ${category}${context}`, actionLabel: 'flatter', maxPrice: undefined }
  }

  if (action === 'different_colour') {
    return { query: `${category} in a different colour${context}`, actionLabel: 'different-colour', maxPrice: undefined }
  }

  return { query: `${category}${context}`, actionLabel: 'new', maxPrice: undefined }
}
