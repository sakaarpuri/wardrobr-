'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff, Sparkles, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { ClarificationPrompt, Product } from '@/lib/types'
import { useVoiceCapture } from '@/hooks/useVoiceCapture'
import { useAssistantSpeech } from '@/hooks/useAssistantSpeech'

export function VoiceStyler({
  compact = false,
  autoStart = false,
  onAutoStartHandled,
}: {
  compact?: boolean
  autoStart?: boolean
  onAutoStartHandled?: () => void
}) {
  const [typedPrompt, setTypedPrompt] = useState('')
  const [showTypedInput, setShowTypedInput] = useState(false)
  const autoStartedRef = useRef(false)

  const {
    addMessage,
    setLoading,
    setCurrentBoard,
    setOccasionContext,
    userProfile,
  } = useChatStore()
  const { speak, stop: stopSpeaking } = useAssistantSpeech()

  const runStyleRequest = useCallback(async (text: string) => {
    if (!text.trim()) {
      return
    }

    setOccasionContext(text)

    addMessage({ type: 'user_text', content: text })
    const loadingMsg = addMessage({ type: 'system_loading', content: 'Working on it…' })
    setLoading(true)
    speak('Got it. Working on it.')

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
              if (event.text) {
                speak(event.text)
              }
              addMessage({ type: 'ai_clarification', content: event.text, clarification: event.clarification })
            } else if (event.text && !event.outfitBoard) {
              speak(event.text)
              addMessage({ type: 'ai_text', content: event.text })
            }

            if (event.outfitBoard) {
              if (event.text) {
                speak(event.text)
              }
              addMessage({ type: 'ai_outfit_board', outfitBoard: event.outfitBoard })
              setCurrentBoard(event.outfitBoard)
            }
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'Unknown error')
          }
        }
      }
    } catch (error) {
      useChatStore.setState((state) => ({
        messages: state.messages.filter((message) => message.id !== loadingMsg.id && message.id !== productStreamId),
      }))
      addMessage({
        type: 'ai_text',
        content: error instanceof Error ? error.message : "Sorry, I couldn't process that. Please try again.",
      })
      speak(error instanceof Error ? error.message : "Sorry, I couldn't process that. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [addMessage, setCurrentBoard, setLoading, setOccasionContext, speak, userProfile])

  const { voiceState, transcript, isSupported, startListening, stopListening, cancelListening } = useVoiceCapture({
    onTranscript: runStyleRequest,
    continuous: true,
  })

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !isSupported || voiceState !== 'idle') return
    autoStartedRef.current = true
    onAutoStartHandled?.()
    void startListening()
  }, [autoStart, isSupported, onAutoStartHandled, startListening, voiceState])

  useEffect(() => {
    if (voiceState === 'listening') {
      stopSpeaking()
    }
  }, [stopSpeaking, voiceState])

  const submitTypedPrompt = useCallback(() => {
    const text = typedPrompt.trim()
    if (!text) return
    setTypedPrompt('')
    void runStyleRequest(text)
  }, [runStyleRequest, typedPrompt])

  if (!isSupported) {
    return (
      <div className={`rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] ${compact ? 'p-4' : 'p-5'}`}>
        <p className="text-sm font-semibold text-[var(--text)]">Voice needs mic access in a modern browser.</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          You can still type or upload a photo below.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-[30px] border border-[rgba(82,126,255,0.18)] bg-[linear-gradient(135deg,rgba(82,126,255,0.16),rgba(104,220,255,0.12),rgba(255,255,255,0.22))] shadow-[0_24px_70px_rgba(49,98,255,0.12)] backdrop-blur-xl ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`font-semibold tracking-tight text-[var(--text)] ${compact ? 'text-lg' : 'text-xl'}`}>
            {voiceState === 'listening' ? 'Listening now' : 'Voice'}
          </h2>
        </div>
        <Sparkles className="h-5 w-5 text-[#E8A94A]" />
      </div>

      {voiceState === 'idle' && (
        <>
          <button
            onClick={startListening}
            className={`mt-4 flex w-full items-center justify-between rounded-[24px] border border-white/35 bg-white/60 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-sm transition-all hover:border-white/55 hover:bg-white/72 ${compact ? 'px-3.5 py-3.5' : 'px-4 py-4'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center rounded-full border border-[rgba(82,126,255,0.24)] bg-white/80 ${compact ? 'h-11 w-11' : 'h-12 w-12'}`}>
                <Mic className="h-5 w-5 text-[var(--text)]" />
              </div>
              <div>
                <p className={`font-semibold text-[var(--text)] ${compact ? 'text-[15px]' : 'text-sm'}`}>Talk to Wardrobr</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  Tap once, speak naturally, and I will jump in when you pause.
                </p>
              </div>
            </div>
            <ArrowIndicator label="Tap to talk" />
          </button>

          <div className="mt-4 rounded-[22px] border border-white/35 bg-white/60 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                  Type instead
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                  Quick for a small change, like cheaper, darker, or flats instead.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTypedInput((current) => !current)}
                className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-[#E8A94A]/35"
              >
                {showTypedInput ? 'Hide' : 'Open'}
              </button>
            </div>

            {showTypedInput && (
              <div className="mt-3 flex flex-col gap-3">
                <textarea
                  value={typedPrompt}
                  onChange={(event) => setTypedPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      submitTypedPrompt()
                    }
                  }}
                  rows={2}
                  placeholder="Type a quick tweak..."
                  className="min-h-[72px] w-full resize-none rounded-[18px] border border-[var(--border)] bg-white/82 px-3.5 py-3 text-[16px] leading-relaxed text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
                />
                <button
                  type="button"
                  onClick={submitTypedPrompt}
                  disabled={!typedPrompt.trim()}
                  className={`inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-all ${
                    typedPrompt.trim()
                      ? 'bg-[#E8A94A] text-[#1A0E00] hover:bg-[#f0b85a]'
                      : 'cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--text-faint)]'
                  }`}
                >
                  Send typed tweak
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {voiceState !== 'idle' && (
        <div className="mt-4 space-y-4">
            <div className={`rounded-[24px] border ${voiceState === 'listening' ? 'border-[#E8A94A]/45 bg-[linear-gradient(135deg,rgba(232,169,74,0.14),rgba(255,255,255,0.68))]' : 'border-white/35 bg-white/68'} backdrop-blur-sm ${compact ? 'px-3.5 py-3.5' : 'px-4 py-4'}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text)]">
                {voiceState === 'listening' ? 'Listening...' : voiceState === 'processing' ? 'Working on it...' : 'Voice issue'}
              </p>
              {voiceState === 'processing' ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#E8A94A]" />
              ) : (
                <Mic className={`h-4 w-4 ${voiceState === 'error' ? 'text-red-500' : 'text-[#E8A94A]'}`} />
              )}
            </div>
            <p className="mt-3 min-h-[40px] text-sm leading-relaxed text-[var(--text-muted)]">
              {voiceState === 'error'
                ? (transcript || 'We could not catch that clearly. Try one short voice tweak.')
                : voiceState === 'processing'
                ? 'I got it. I am working that into the picks now.'
                : 'Say the next tweak naturally. I will jump in once you pause.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cancelListening}
              className={`flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-4 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)] ${compact ? 'h-10' : 'h-11'}`}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={voiceState === 'listening' ? stopListening : undefined}
              disabled={voiceState === 'processing'}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-all ${compact ? 'h-10' : 'h-11'} ${
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
                  Done now
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ArrowIndicator({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-[rgba(82,126,255,0.22)] bg-white/70 px-3 py-1.5 text-xs text-[var(--text)]">
      {label}
    </div>
  )
}
