'use client'

import { useEffect, useRef } from 'react'
import { useChatStore, buildProfileContext } from '@/store/chatStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { track } from '@/lib/posthog'
import { Product } from '@/lib/types'

const GENDER_OPTIONS = ['Women', 'Men'] as const
const SIZE_OPTIONS   = ['6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL'] as const
const BUDGET_OPTIONS = ['Under £50', '£50–150', '£150–300', '£300+'] as const

export function ChatInterface() {
  const {
    messages, isLoading,
    addMessage, setLoading, setCurrentBoard, setOccasionContext,
    userProfile, setUserProfile,
    pendingMessage, setPendingMessage,
  } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasFiredPending = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fire pending message from homepage on first mount
  useEffect(() => {
    if (pendingMessage && !hasFiredPending.current) {
      hasFiredPending.current = true
      const { text, imageBase64, imageMimeType, imagePreview } = pendingMessage
      setPendingMessage(null)
      handleSend(text, imageBase64, imageMimeType, imagePreview)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = async (
    text: string,
    imageBase64?: string,
    imageMimeType?: string,
    imagePreview?: string
  ) => {
    let productStreamId: string | null = null
    if (text) setOccasionContext(text)

    if (messages.length === 0) track('session_started', { occasion: text })

    if (imageBase64) {
      addMessage({ type: 'user_image', content: text || undefined, imageUrl: imagePreview, imageBase64 })
    } else {
      addMessage({ type: 'user_text', content: text })
    }

    const loadingMsg = addMessage({ type: 'system_loading' })
    setLoading(true)

    try {
      const history = messages
        .filter((m) => m.type === 'user_text' || m.type === 'ai_text')
        .map((m) => ({
          role: m.type === 'user_text' ? 'user' : 'model',
          parts: [{ text: m.content ?? '' }],
        }))

      // Prepend user profile context if set
      const profileCtx = buildProfileContext(userProfile)
      const messageWithCtx = profileCtx ? `${profileCtx}\n${text}` : text

      const response = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageWithCtx || (imageBase64 ? 'Please style this look and find me similar purchasable items.' : ''),
          imageBase64,
          imageMimeType,
          history,
        }),
      })

      if (!response.ok) throw new Error('Request failed')
      if (!response.body) throw new Error('No response body')

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
            hasBoard?: boolean
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
              messages: state.messages.filter((m) => m.id !== loadingMsg.id && m.id !== sid),
            }))
            productStreamId = null
            if (event.text) addMessage({ type: 'ai_text', content: event.text })
            if (event.outfitBoard) {
              addMessage({ type: 'ai_outfit_board', outfitBoard: event.outfitBoard })
              setCurrentBoard(event.outfitBoard)
              track('board_generated', { occasion_type: event.outfitBoard.occasion })
            }
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'Unknown error')
          }
        }
      }
    } catch {
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== loadingMsg.id),
      }))
      addMessage({ type: 'ai_text', content: "Sorry, I couldn't process that request. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-4">
            <div className="space-y-1.5">
              <p className="text-white/70 text-base font-medium">What are you dressing for?</p>
              <p className="text-white/35 text-sm max-w-xs leading-relaxed">
                Tell me the occasion, budget, size, or a brand for inspiration.
              </p>
            </div>

            {/* Quick profile setup */}
            <div className="w-full max-w-xs space-y-3 text-left">
              {/* Gender */}
              <div>
                <p className="text-white/25 text-xs uppercase tracking-wider mb-1.5">Shopping for</p>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setUserProfile({ gender: userProfile.gender === g.toLowerCase() as 'women' | 'men' ? null : g.toLowerCase() as 'women' | 'men' })}
                      className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                        userProfile.gender === g.toLowerCase()
                          ? 'border-white/40 text-white bg-white/10'
                          : 'border-white/12 text-white/45 hover:border-white/25 hover:text-white/65'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <p className="text-white/25 text-xs uppercase tracking-wider mb-1.5">UK size</p>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setUserProfile({ size: userProfile.size === s ? null : s })}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        userProfile.size === s
                          ? 'border-white/40 text-white bg-white/10'
                          : 'border-white/12 text-white/45 hover:border-white/25 hover:text-white/65'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div>
                <p className="text-white/25 text-xs uppercase tracking-wider mb-1.5">Budget</p>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((b) => (
                    <button
                      key={b}
                      onClick={() => setUserProfile({ budget: userProfile.budget === b ? null : b })}
                      className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                        userProfile.budget === b
                          ? 'border-white/40 text-white bg-white/10'
                          : 'border-white/12 text-white/45 hover:border-white/25 hover:text-white/65'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 justify-center max-w-sm mt-1">
              {[
                'Summer wedding guest',
                'New job, first week',
                'Holiday capsule',
                'Night out in London',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="text-xs text-white/50 border border-white/12 rounded-full px-4 py-2 hover:border-white/30 hover:text-white/75 hover:bg-white/5 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-white/5">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  )
}
