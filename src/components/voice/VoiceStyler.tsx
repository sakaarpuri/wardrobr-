'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { Product } from '@/lib/types'

type VoiceState = 'idle' | 'listening' | 'processing' | 'error'

// Type augments for Web Speech API (not in default lib.dom.d.ts in all envs)
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    abort(): void
    onresult: ((e: SpeechRecognitionEvent) => void) | null
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
  }
  interface SpeechRecognitionResultList {
    readonly length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }
  interface SpeechRecognitionResult {
    readonly isFinal: boolean
    readonly length: number
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
  }
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string
  }
}

export function VoiceStyler() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(true)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef('')

  const { addMessage, setLoading, setCurrentBoard, setOccasionContext } = useChatStore()

  useEffect(() => {
    const supported = !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
    setIsSupported(supported)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  /** Run the style request using the same SSE pipeline as text chat */
  const runStyleRequest = useCallback(async (text: string) => {
    if (!text.trim()) {
      setVoiceState('idle')
      return
    }

    setOccasionContext(text)
    setVoiceState('processing')

    addMessage({ type: 'user_text', content: text })
    const loadingMsg = addMessage({ type: 'system_loading', content: 'Styling your look…' })
    setLoading(true)

    let productStreamId: string | null = null

    try {
      const history = useChatStore.getState().messages
        .filter((m) => m.type === 'user_text' || m.type === 'ai_text')
        .map((m) => ({
          role: m.type === 'user_text' ? 'user' : 'model',
          parts: [{ text: m.content ?? '' }],
        }))

      const response = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      if (!response.ok || !response.body) throw new Error('Request failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          if (!chunk.startsWith('data: ')) continue
          let event: {
            type: string
            text?: string
            products?: Product[]
            outfitBoard?: import('@/lib/types').OutfitBoard
            error?: string
          }
          try { event = JSON.parse(chunk.slice(6)) } catch { continue }

          if (event.type === 'status' && event.text) {
            useChatStore.setState((state) => ({
              messages: state.messages.map((m) =>
                m.id === loadingMsg.id ? { ...m, content: event.text } : m
              ),
            }))
          } else if (event.type === 'products') {
            const incoming = event.products ?? []
            if (incoming.length === 0) continue
            if (!productStreamId) {
              const streamMsg = addMessage({ type: 'ai_product_stream', products: incoming })
              productStreamId = streamMsg.id
            } else {
              const sid = productStreamId
              useChatStore.setState((state) => ({
                messages: state.messages.map((m) =>
                  m.id === sid ? { ...m, products: [...(m.products ?? []), ...incoming] } : m
                ),
              }))
            }
          } else if (event.type === 'result') {
            const sid = productStreamId
            useChatStore.setState((state) => ({
              messages: state.messages.filter(
                (m) => m.id !== loadingMsg.id && m.id !== sid
              ),
            }))
            productStreamId = null

            if (event.text) {
              addMessage({ type: 'ai_text', content: event.text })
              // Speak the AI response via browser TTS (first ~300 chars)
              if (typeof window !== 'undefined' && window.speechSynthesis && event.text) {
                window.speechSynthesis.cancel()
                const utt = new SpeechSynthesisUtterance(event.text.slice(0, 300))
                utt.rate = 1.1
                utt.lang = 'en-GB'
                window.speechSynthesis.speak(utt)
              }
            }
            if (event.outfitBoard) {
              addMessage({ type: 'ai_outfit_board', outfitBoard: event.outfitBoard })
              setCurrentBoard(event.outfitBoard)
            }
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'Unknown error')
          }
        }
      }
    } catch {
      useChatStore.setState((state) => ({
        messages: state.messages.filter(
          (m) => m.id !== loadingMsg.id && m.id !== productStreamId
        ),
      }))
      addMessage({ type: 'ai_text', content: "Sorry, I couldn't process that. Please try again." })
    } finally {
      setLoading(false)
      setVoiceState('idle')
      setTranscript('')
      finalTranscriptRef.current = ''
    }
  }, [addMessage, setCurrentBoard, setLoading, setOccasionContext])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { setIsSupported(false); return }

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-GB'
    recognitionRef.current = recognition
    finalTranscriptRef.current = ''

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      if (final) finalTranscriptRef.current = final
      setTranscript(final || interim)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') setVoiceState('error')
    }

    recognition.onend = () => {
      const text = finalTranscriptRef.current.trim()
      if (text) {
        runStyleRequest(text)
      } else {
        setVoiceState('idle')
        setTranscript('')
      }
    }

    try {
      recognition.start()
      setVoiceState('listening')
    } catch {
      setVoiceState('error')
    }
  }, [runStyleRequest])

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    stopListening()
    setVoiceState('idle')
    setTranscript('')
    finalTranscriptRef.current = ''
  }, [stopListening])

  useEffect(() => () => { stopListening() }, [stopListening])

  if (!isSupported) return null

  // ─── Idle: floating mic FAB ────────────────────────────────────────────────
  if (voiceState === 'idle') {
    return (
      <button
        onClick={startListening}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:bg-white/90 active:scale-95 transition-all"
        aria-label="Start voice styling"
        title="Tap, speak your request, stop speaking to send"
      >
        <Mic className="w-6 h-6" />
      </button>
    )
  }

  // ─── Active: transcript + controls ─────────────────────────────────────────
  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 w-72">
      {transcript && (
        <div className="bg-white/10 backdrop-blur-sm text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 border border-white/10 leading-snug self-end max-w-full">
          {transcript}
        </div>
      )}

      <div className="flex items-center gap-2 self-end">
        <button
          onClick={cancel}
          className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500/20 active:scale-95 transition-all"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={[
            'w-14 h-14 rounded-full flex items-center justify-center shadow-lg select-none',
            voiceState === 'listening' && 'bg-white text-black animate-pulse',
            voiceState === 'processing' && 'bg-zinc-700 text-white/50',
            voiceState === 'error' && 'bg-red-500/50 text-white',
          ].filter(Boolean).join(' ')}
        >
          {voiceState === 'processing' ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </div>
      </div>

      <p className="text-white/30 text-xs self-end">
        {voiceState === 'listening' && 'Listening — stop speaking to send'}
        {voiceState === 'processing' && 'Styling your look…'}
        {voiceState === 'error' && 'Mic error — tap × to close'}
      </p>
    </div>
  )
}
