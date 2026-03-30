import { GoogleGenAI, Modality } from '@google/genai'
import { NextResponse } from 'next/server'
import { resolveTtsVoice } from '@/lib/voice'

export const maxDuration = 30

function getTtsClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenAI({ apiKey })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { text?: string; locale?: string | null } | null
    const text = body?.text?.trim()
    const locale = body?.locale?.trim() || 'en-GB'

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const voiceName = resolveTtsVoice(locale)
    const prompt =
      locale === 'hi-IN'
        ? `Say this warmly, clearly, and briefly in natural Hindi or Indian English where appropriate. Speak only the quoted line: "${text}"`
        : `Say this warmly, clearly, and briefly in a natural local accent. Speak only the quoted line: "${text}"`

    const response = await getTtsClient().models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          languageCode: locale,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    })

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!data) {
      return NextResponse.json({ error: 'No audio returned' }, { status: 502 })
    }

    return NextResponse.json({
      audioBase64: data,
      mimeType: 'audio/pcm;rate=24000',
    })
  } catch (error) {
    console.error('Voice speak error:', error)
    return NextResponse.json({ error: 'Voice speech generation failed' }, { status: 500 })
  }
}
