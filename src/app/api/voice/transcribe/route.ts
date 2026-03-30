import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

function getAudioModel() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
    },
  })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    const localeHint = formData.get('localeHint')

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Audio file missing' }, { status: 400 })
    }

    if (!audio.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Unsupported audio type' }, { status: 400 })
    }

    const bytes = await audio.arrayBuffer()
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 })
    }

    const result = await getAudioModel().generateContent([
      {
        inlineData: {
          mimeType: audio.type,
          data: Buffer.from(bytes).toString('base64'),
        },
      },
      typeof localeHint === 'string' && localeHint.toLowerCase().startsWith('hi')
        ? 'Generate a clean transcript of the speech. The shopper may speak Hindi or Indian English. Return only the transcript in the original language and script. No labels, no translation, no commentary.'
        : 'Generate a clean transcript of the speech. Prefer English transcription unless the speech is clearly another language. Return only the transcript in the original language and script. No labels, no translation, no commentary.',
    ])

    const transcript = result.response.text().trim()
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript returned' }, { status: 502 })
    }

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error('Voice transcription error:', error)
    return NextResponse.json({ error: 'Voice transcription failed' }, { status: 500 })
  }
}
