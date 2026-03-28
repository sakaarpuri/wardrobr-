'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { Product, OutfitBoard } from '@/lib/types'

type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

// ─── Audio helpers ─────────────────────────────────────────────────────────────

/** Downsample Float32 buffer from native browser rate to 16 kHz and encode as Int16 PCM */
function downsampleToInt16(buffer: Float32Array, inputRate: number): Int16Array {
  const outputRate = 16000
  const ratio = inputRate / outputRate
  const length = Math.floor(buffer.length / ratio)
  const result = new Int16Array(length)
  for (let i = 0; i < length; i++) {
    result[i] = Math.max(-32768, Math.min(32767, buffer[Math.floor(i * ratio)] * 32768))
  }
  return result
}

/** Int16 PCM → Float32 for Web Audio playback */
function int16ToFloat32(int16: Int16Array): Float32Array {
  const out = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 32768
  return out
}

/** Int16Array → base64 string */
function int16ToBase64(typed: Int16Array): string {
  const bytes = new Uint8Array(typed.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** base64 string → Float32Array (expects 16-bit PCM at 24 kHz from Google) */
function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return int16ToFloat32(new Int16Array(bytes.buffer))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceStyler() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [userTranscript, setUserTranscript] = useState('')
  const [aiTranscript, setAiTranscript] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processorRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const productsRef = useRef<Map<string, Product>>(new Map())
  const nextPlayTimeRef = useRef(0)
  const aiTextAccRef = useRef('')

  const { addMessage, setCurrentBoard } = useChatStore()

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close()
    wsRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    productsRef.current.clear()
    nextPlayTimeRef.current = 0
    aiTextAccRef.current = ''
    setUserTranscript('')
    setAiTranscript('')
    setVoiceState('idle')
  }, [])

  /** Schedule a 24 kHz mono Float32 audio chunk for gapless playback */
  const playPcm = useCallback((float32: Float32Array) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const buf = ctx.createBuffer(1, float32.length, 24000)
    buf.getChannelData(0).set(float32)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const now = ctx.currentTime
    const start = Math.max(now, nextPlayTimeRef.current)
    src.start(start)
    nextPlayTimeRef.current = start + buf.duration
  }, [])

  /** Handle a toolCall message from Google — fetch products and return results */
  const handleToolCall = useCallback(
    async (toolCall: {
      functionCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>
    }) => {
      const responses = await Promise.all(
        toolCall.functionCalls.map(async (call) => {
          if (call.name !== 'search_products') {
            return { name: call.name, id: call.id, response: { error: 'Unknown function' } }
          }
          const args = call.args as {
            query: string
            category?: string
            price_max?: number
            gender?: string
            occasion?: string
          }
          const p = new URLSearchParams({ query: args.query, limit: '5' })
          if (args.category) p.set('category', args.category)
          if (args.price_max) p.set('maxPrice', String(args.price_max))
          if (args.gender) p.set('gender', args.gender)

          try {
            const res = await fetch(`/api/products?${p}`)
            const data = await res.json()
            for (const product of data.products ?? []) {
              productsRef.current.set(product.id, product)
            }
            return {
              name: call.name,
              id: call.id,
              response: {
                products: (data.products ?? []).map((pr: Product) => ({
                  id: pr.id,
                  name: pr.name,
                  brand: pr.brand,
                  price: pr.price,
                  currency: pr.currency,
                  storeName: pr.storeName,
                  category: pr.category,
                })),
              },
            }
          } catch {
            return { name: call.name, id: call.id, response: { products: [] } }
          }
        })
      )

      wsRef.current?.send(JSON.stringify({ toolResponse: { functionResponses: responses } }))
    },
    []
  )

  const startVoice = useCallback(async () => {
    setVoiceState('connecting')
    setUserTranscript('')
    setAiTranscript('')
    productsRef.current.clear()
    aiTextAccRef.current = ''

    try {
      // 1. Get ephemeral token (keeps API key server-side)
      const tokenRes = await fetch('/api/live-token', { method: 'POST' })
      if (!tokenRes.ok) throw new Error('Failed to get live token')
      const { token } = await tokenRes.json()

      // 2. Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 3. Create AudioContext for capture + playback
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      nextPlayTimeRef.current = ctx.currentTime

      // 4. Connect WebSocket directly to Google (low-latency path)
      const ws = new WebSocket(`${LIVE_WS_URL}?access_token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        // Send session setup immediately
        ws.send(
          JSON.stringify({
            setup: {
              model: 'models/gemini-3.1-flash-live-preview',
              generationConfig: { responseModalities: ['AUDIO', 'TEXT'] },
              realtimeInputConfig: {
                // Prompt 3: automatic activity detection — model ignores background noise
                automaticActivityDetection: { disabled: false },
              },
              systemInstruction: {
                parts: [
                  {
                    text: 'You are Wardrobr.ai, an expert personal stylist. When the user describes what they need, use the search_products tool to find real items. Be conversational and opinionated — like a fashionable friend. Default currency GBP. Default region UK. Always explain WHY you are recommending each item.',
                  },
                ],
              },
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: 'search_products',
                      description: 'Search for clothing items available to purchase online',
                      parameters: {
                        type: 'OBJECT',
                        properties: {
                          query: { type: 'STRING', description: 'Search query for clothing' },
                          category: {
                            type: 'STRING',
                            enum: ['tops', 'bottoms', 'outerwear', 'footwear', 'accessories'],
                          },
                          price_max: { type: 'NUMBER', description: 'Max price in GBP' },
                          gender: { type: 'STRING', enum: ['men', 'women', 'unisex'] },
                          occasion: { type: 'STRING', description: 'e.g. wedding, work, date night' },
                        },
                        required: ['query'],
                      },
                    },
                  ],
                },
              ],
            },
          })
        )
      }

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(event.data as string)
        } catch {
          return
        }

        // Session ready — start streaming mic audio
        if (msg.setupComplete) {
          setVoiceState('listening')

          const source = ctx.createMediaStreamSource(stream)
          // ScriptProcessorNode is deprecated but has universal browser support
          const proc = ctx.createScriptProcessor(4096, 1, 1)
          processorRef.current = proc

          proc.onaudioprocess = (e: AudioProcessingEvent) => {
            if (ws.readyState !== WebSocket.OPEN) return
            const pcm16 = downsampleToInt16(e.inputBuffer.getChannelData(0), ctx.sampleRate)
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: int16ToBase64(pcm16) }],
                },
              })
            )
          }

          source.connect(proc)
          proc.connect(ctx.destination)
        }

        if (msg.serverContent) {
          const sc = msg.serverContent as Record<string, unknown>

          // What the user said (input transcription)
          if (sc.inputTranscription) {
            const t = (sc.inputTranscription as { text?: string }).text
            if (t) setUserTranscript(t)
          }

          // AI text response (output transcription — streams incrementally)
          if (sc.outputTranscription) {
            const t = (sc.outputTranscription as { text?: string }).text
            if (t) {
              aiTextAccRef.current += t
              setAiTranscript(aiTextAccRef.current)
            }
          }

          // Model turn — audio chunks and/or text
          if (sc.modelTurn) {
            const parts = (
              sc.modelTurn as {
                parts?: Array<{
                  text?: string
                  inlineData?: { mimeType: string; data: string }
                }>
              }
            ).parts ?? []

            for (const part of parts) {
              if (part.inlineData?.mimeType === 'audio/pcm') {
                playPcm(base64ToFloat32(part.inlineData.data))
                setVoiceState('speaking')
              }
            }
          }

          // Turn complete — commit AI text and products to chat
          if (sc.turnComplete) {
            setVoiceState('listening')

            const accText = aiTextAccRef.current
            if (accText) {
              addMessage({ type: 'ai_text', content: accText })
              aiTextAccRef.current = ''
              setAiTranscript('')
            }

            if (productsRef.current.size > 0) {
              const products = Array.from(productsRef.current.values()).slice(0, 6)
              const board: OutfitBoard = {
                id: globalThis.crypto.randomUUID(),
                title: 'Voice Styled Outfit',
                products,
                createdAt: new Date().toISOString(),
              }
              addMessage({ type: 'ai_outfit_board', outfitBoard: board })
              setCurrentBoard(board)
              productsRef.current.clear()
            }
          }
        }

        // Tool call — fetch products and return results to model
        if (msg.toolCall) {
          handleToolCall(
            msg.toolCall as {
              functionCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>
            }
          )
        }
      }

      ws.onerror = () => {
        console.error('Voice WebSocket error')
        setVoiceState('error')
      }

      ws.onclose = () => {
        setVoiceState((s) => (s !== 'idle' ? 'idle' : s))
      }
    } catch (err) {
      console.error('Voice start error:', err)
      setVoiceState('error')
    }
  }, [addMessage, handleToolCall, playPcm, setCurrentBoard])

  const stopVoice = useCallback(() => {
    const t = userTranscript
    if (t) addMessage({ type: 'user_text', content: t })
    cleanup()
  }, [addMessage, cleanup, userTranscript])

  // Cleanup on unmount
  useEffect(() => () => { cleanup() }, [cleanup])

  // ─── Idle: floating mic FAB ────────────────────────────────────────────────
  if (voiceState === 'idle') {
    return (
      <button
        onClick={startVoice}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:bg-white/90 active:scale-95 transition-all"
        aria-label="Start voice styling"
      >
        <Mic className="w-6 h-6" />
      </button>
    )
  }

  // ─── Active: transcript bubbles + controls ─────────────────────────────────
  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 w-72">
      {userTranscript && (
        <div className="bg-white/10 backdrop-blur-sm text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 border border-white/10 leading-snug self-end">
          {userTranscript}
        </div>
      )}
      {aiTranscript && (
        <div className="bg-zinc-800 text-white/80 text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 border border-white/10 leading-snug self-start">
          {aiTranscript}
        </div>
      )}

      <div className="flex items-center gap-2 self-end">
        <button
          onClick={stopVoice}
          className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500/20 active:scale-95 transition-all"
          aria-label="End voice session"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={[
            'w-14 h-14 rounded-full flex items-center justify-center shadow-lg select-none',
            voiceState === 'connecting' && 'bg-white/30 text-white/50',
            voiceState === 'listening' && 'bg-white text-black animate-pulse',
            voiceState === 'speaking' && 'bg-zinc-700 text-white',
            voiceState === 'error' && 'bg-red-500/50 text-white',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {voiceState === 'speaking' ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </div>
      </div>

      <p className="text-white/30 text-xs self-end">
        {voiceState === 'connecting' && 'Connecting…'}
        {voiceState === 'listening' && 'Listening…'}
        {voiceState === 'speaking' && 'Styling…'}
        {voiceState === 'error' && 'Error — tap × to close'}
      </p>
    </div>
  )
}
