import { NextResponse } from 'next/server'

/**
 * Generates a short-lived ephemeral token for the Gemini Live API.
 * The client connects directly to Google's WebSocket using this token,
 * keeping the API key server-side and reducing latency.
 */
export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/ephemeralTokens?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-3.1-flash-live-preview',
          config: {
            responseModalities: ['AUDIO', 'TEXT'],
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Ephemeral token error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to create token' }, { status: 502 })
    }

    const data = await response.json()
    return NextResponse.json({ token: data.token })
  } catch (error) {
    console.error('Live token error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
