import { GoogleGenAI, Modality } from '@google/genai'
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
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    })

    const now = Date.now()
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 10 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: 'models/gemini-3.1-flash-live-preview',
          config: {
            responseModalities: [Modality.TEXT],
            inputAudioTranscription: {},
            temperature: 0.1,
            systemInstruction:
              'Transcribe the shopper faithfully in the original language and script. Do not answer the shopper, translate, summarize, or add commentary.',
          },
        },
        lockAdditionalFields: [
          'responseModalities',
          'inputAudioTranscription',
          'systemInstruction',
          'temperature',
        ],
      }
    })

    if (!token.name) {
      return NextResponse.json({ error: 'Failed to create token' }, { status: 502 })
    }

    return NextResponse.json({ token: token.name })
  } catch (error) {
    console.error('Live token error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
