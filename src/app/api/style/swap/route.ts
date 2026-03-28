import { NextRequest, NextResponse } from 'next/server'
import { searchProducts, rewriteAffiliateUrl } from '@/lib/affiliate'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { category, occasionContext } = body as {
      productId?: string
      category?: string
      occasionContext?: string
    }

    if (!category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 })
    }

    // Build a search query from the category + occasion context
    const query = occasionContext
      ? `${category} for ${occasionContext}`
      : category

    const result = await searchProducts({ query, category, limit: 5 })

    // Rewrite affiliate URLs server-side before returning to client
    const alternatives = await Promise.all(
      result.products.slice(0, 3).map(async (p) => ({
        ...p,
        affiliateUrl: await rewriteAffiliateUrl(p.productUrl),
      }))
    )

    return NextResponse.json({ alternatives })
  } catch (error) {
    console.error('Swap API error:', error)
    return NextResponse.json({ error: 'Failed to find alternatives' }, { status: 500 })
  }
}
