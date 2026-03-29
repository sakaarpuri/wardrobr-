'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, Mic, MicOff, Sparkles, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { ClarificationPrompt, Product } from '@/lib/types'

type VoiceState = 'idle' | 'listening' | 'processing' | 'error'

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

  const {
    addMessage,
    setLoading,
    setCurrentBoard,
    setOccasionContext,
    userProfile,
  } = useChatStore()

  useEffect(() => {
    const supported = !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
    setIsSupported(supported)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

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
        .filter((message) => message.type === 'user_text' || message.type === 'ai_text' || message.type === 'ai_clarification')
        .map((message) => ({
          role: message.type === 'user_text' ? 'user' : 'model',
          parts: [{ text: message.content ?? '' }],
        }))

      const response = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, profile: userProfile }),
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
            clarification?: ClarificationPrompt
            error?: string
          }

          try {
            event = JSON.parse(chunk.slice(6))
          } catch {
            continue
          }

          if (event.type === 'status' && event.text) {
            useChatStore.setState((state) => ({
              messages: state.messages.map((message) =>
                message.id === loadingMsg.id ? { ...message, content: event.text } : message
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
                messages: state.messages.map((message) =>
                  message.id === sid ? { ...message, products: [...(message.products ?? []), ...incoming] } : message
                ),
              }))
            }
          } else if (event.type === 'result') {
            const sid = productStreamId
            useChatStore.setState((state) => ({
              messages: state.messages.filter((message) => message.id !== loadingMsg.id && message.id !== sid),
            }))
            productStreamId = null

            if (event.clarification) {
              addMessage({ type: 'ai_clarification', content: event.text, clarification: event.clarification })
            } else if (event.text && !event.outfitBoard) {
              addMessage({ type: 'ai_text', content: event.text })
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
        messages: state.messages.filter((message) => message.id !== loadingMsg.id && message.id !== productStreamId),
      }))
      addMessage({ type: 'ai_text', content: "Sorry, I couldn't process that. Please try again." })
    } finally {
      setLoading(false)
      setVoiceState('idle')
      setTranscript('')
      finalTranscriptRef.current = ''
    }
  }, [addMessage, setCurrentBoard, setLoading, setOccasionContext, userProfile])

  const submitNow = useCallback(() => {
    const text = finalTranscriptRef.current.trim()
    stopListening()
    if (text) runStyleRequest(text)
    else {
      setVoiceState('idle')
      setTranscript('')
    }
  }, [runStyleRequest, stopListening])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      setIsSupported(false)
      return
    }

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
        const result = e.results[i]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }
      if (final) finalTranscriptRef.current = final
      setTranscript(final || interim)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') setVoiceState('error')
    }

    recognition.onend = () => {
      const text = finalTranscriptRef.current.trim()
      if (text) runStyleRequest(text)
      else {
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
    stopListening()
    setVoiceState('idle')
    setTranscript('')
    finalTranscriptRef.current = ''
  }, [stopListening])

  useEffect(() => () => { stopListening() }, [stopListening])

  if (!isSupported) {
    return (
      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <p className="text-sm font-semibold text-[var(--text)]">Voice needs Safari or Chrome.</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          You can still type or upload a photo below.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[30px] border border-[rgba(82,126,255,0.18)] bg-[linear-gradient(135deg,rgba(82,126,255,0.16),rgba(104,220,255,0.12),rgba(255,255,255,0.22))] p-5 shadow-[0_24px_70px_rgba(49,98,255,0.12)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
            Voice Stylist
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
            Talk to Wardrobr
          </h2>
        </div>
        <Sparkles className="h-5 w-5 text-[#E8A94A]" />
      </div>

      {voiceState === 'idle' && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
            Best route in. Say the brief naturally, then let the shopping results build from there.
          </p>
          <button
            onClick={startListening}
            className="mt-5 flex w-full items-center justify-between rounded-[24px] border border-white/35 bg-white/60 px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-sm transition-all hover:border-white/55 hover:bg-white/72"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(82,126,255,0.24)] bg-white/80">
                <Mic className="h-5 w-5 text-[var(--text)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Start voice styling</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  Tap once, speak, stop. We’ll send it automatically.
                </p>
              </div>
            </div>
            <ArrowIndicator />
          </button>

          <div className="mt-4 space-y-2 text-xs text-[var(--text-muted)]">
            <p>Try saying:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Trip to India in summer',
                'Wedding guest look under £150',
                'Find me one great blazer for work',
              ].map((prompt) => (
                <span key={prompt} className="rounded-full border border-[var(--border)] bg-white/55 px-3 py-1.5">
                  {prompt}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {voiceState !== 'idle' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-[24px] border border-white/35 bg-white/68 px-4 py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text)]">
                {voiceState === 'listening' ? 'Listening...' : voiceState === 'processing' ? 'Processing...' : 'Voice issue'}
              </p>
              {voiceState === 'processing' ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#E8A94A]" />
              ) : (
                <Mic className={`h-4 w-4 ${voiceState === 'error' ? 'text-red-500' : 'text-[#E8A94A]'}`} />
              )}
            </div>
            <p className="mt-3 min-h-[40px] text-sm leading-relaxed text-[var(--text-muted)]">
              {transcript || (voiceState === 'processing' ? 'Styling your look…' : 'Waiting for your brief...')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cancel}
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-4 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={voiceState === 'listening' ? submitNow : undefined}
              disabled={voiceState === 'processing'}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-all ${
                voiceState === 'listening'
                  ? 'bg-[#E8A94A] text-[#1A0E00] hover:bg-[#f0b85a]'
                  : 'cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--text-faint)]'
              }`}
            >
              {voiceState === 'processing' ? (
                <>
                  <MicOff className="h-4 w-4" />
                  Working...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Send voice brief
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ArrowIndicator() {
  return (
    <div className="rounded-full border border-[rgba(82,126,255,0.22)] bg-white/70 px-3 py-1.5 text-xs text-[var(--text)]">
      Tap to speak
    </div>
  )
}
