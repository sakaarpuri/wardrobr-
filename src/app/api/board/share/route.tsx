import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { Product } from '@/lib/types'

export const runtime = 'nodejs'

// Pre-fetch a product image and return a data URL for Satori rendering
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Wardrobr/1.0 (share-image)' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { products, title, occasion } = (await req.json()) as {
      products: Product[]
      title: string
      occasion?: string
    }

    if (!products?.length || !title) {
      return NextResponse.json({ error: 'products and title required' }, { status: 400 })
    }

    const displayProducts = products.slice(0, 6)

    // Pre-fetch images server-side (avoids CORS issues in Satori)
    const productsWithImages = await Promise.all(
      displayProducts.map(async (p) => ({
        ...p,
        dataUrl: await fetchAsDataUrl(p.imageUrl),
      }))
    )

    const colCount = displayProducts.length <= 4 ? 2 : 3
    const cardWidth = colCount === 2 ? 440 : 280
    const imageHeight = colCount === 2 ? 380 : 250

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 1000,
            minHeight: 1000,
            background: '#0a0a0a',
            padding: '40px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '28px' }}>
            <span
              style={{ color: 'white', fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' }}
            >
              {title}
            </span>
            {occasion && (
              <span
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginTop: '6px' }}
              >
                {occasion}
              </span>
            )}
          </div>

          {/* Product Grid */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              flex: 1,
            }}
          >
            {productsWithImages.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: cardWidth,
                  background: '#1a1a1a',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {p.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.dataUrl}
                    alt={p.name}
                    width={cardWidth}
                    height={imageHeight}
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: cardWidth,
                      height: imageHeight,
                      background: '#2a2a2a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                      No image
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    {p.brand}
                  </span>
                  <span
                    style={{
                      color: 'white',
                      fontSize: 13,
                      lineHeight: 1.3,
                    }}
                  >
                    {p.name.length > 40 ? p.name.slice(0, 40) + '…' : p.name}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.currency ?? 'GBP' }).format(p.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Watermark */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '24px',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>wardrobr.ai</span>
          </div>
        </div>
      ),
      {
        width: 1000,
        height: 1000,
      }
    )

    return imageResponse
  } catch (error) {
    console.error('Share route error:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
