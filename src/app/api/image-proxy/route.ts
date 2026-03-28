import { NextRequest, NextResponse } from 'next/server'

// Allowlist of known retailer domains — prevent open-proxy abuse
const ALLOWED_DOMAINS = [
  'asos-media.com',
  'asos.com',
  'lp2.hm.com',
  'hm.com',
  'static.zara.net',
  'zara.com',
  'office.co.uk',
  'whistles.scene7.com',
  'whistles.com',
  'next.co.uk',
  'reiss.com',
  'cos.com',
  'stories.com',
  'uniqlo.com',
  'topshop.com',
  'boohoo.com',
  'missguided.com',
  'nasty-gal.com',
  'riverisland.com',
  'marksandspencer.com',
  'johnlewis.com',
  'selfridges.com',
  'net-a-porter.com',
]

function isAllowedDomain(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_DOMAINS.some((d) => hostname.endsWith(d))
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const urlParam = searchParams.get('url')

  if (!urlParam) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(urlParam)
  } catch {
    return NextResponse.json({ error: 'Invalid url encoding' }, { status: 400 })
  }

  if (!isAllowedDomain(decoded)) {
    return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
  }

  try {
    const upstream = await fetch(decoded, {
      headers: { 'User-Agent': 'Wardrobr/1.0 (image-proxy)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  }
}
