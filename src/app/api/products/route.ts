import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/affiliate'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const query = searchParams.get('query')
  if (!query) {
    return NextResponse.json({ error: 'query parameter required' }, { status: 400 })
  }

  try {
    const result = await searchProducts({
      query,
      category: searchParams.get('category') ?? undefined,
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      gender: (searchParams.get('gender') as 'men' | 'women' | 'unisex') ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 5,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
