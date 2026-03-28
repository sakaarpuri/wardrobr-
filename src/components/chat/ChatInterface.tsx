'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { track } from '@/lib/posthog'

export function ChatInterface() {
  const { messages, isLoading, addMessage, setLoading, setCurrentBoard, setOccasionContext } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (
    text: string,
    imageBase64?: string,
    imageMimeType?: string,
    imagePreview?: string
  ) => {
    // Track occasion context for swap requests
    if (text) setOccasionContext(text)

    // Fire session_started on first message
    if (messages.length === 0) {
      track('session_started', { occasion: text })
    }

    // Add user message
    if (imageBase64) {
      addMessage({
        type: 'user_image',
        content: text || undefined,
        imageUrl: imagePreview,
        imageBase64,
      })
    } else {
      addMessage({ type: 'user_text', content: text })
    }

    // Add loading indicator
    const loadingMsg = addMessage({ type: 'system_loading' })
    setLoading(true)

    try {
      // Build chat history for context
      const history = messages
        .filter((m) => m.type === 'user_text' || m.type === 'ai_text')
        .map((m) => ({
          role: m.type === 'user_text' ? 'user' : 'model',
          parts: [{ text: m.content ?? '' }],
        }))

      const response = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || (imageBase64 ? 'Please style this look and find me similar purchasable items.' : ''),
          imageBase64,
          imageMimeType,
          history,
        }),
      })

      if (!response.ok) throw new Error('Request failed')

      const data = await response.json()

      // Remove loading message and add AI response
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== loadingMsg.id),
      }))

      if (data.text) {
        addMessage({ type: 'ai_text', content: data.text })
      }

      if (data.outfitBoard) {
        addMessage({ type: 'ai_outfit_board', outfitBoard: data.outfitBoard })
        setCurrentBoard(data.outfitBoard)
        track('board_generated', { occasion_type: data.outfitBoard.occasion })
      }
    } catch (error) {
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== loadingMsg.id),
      }))
      addMessage({
        type: 'ai_text',
        content: "Sorry, I couldn't process that request. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <p className="text-white/20 text-sm max-w-xs">
              What&apos;s the occasion? Tell me the dress code, your budget, and when it is — I&apos;ll build the complete outfit.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                'Summer wedding guest look',
                'New job, first week capsule',
                'Holiday capsule wardrobe',
                'Post-breakup wardrobe refresh',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="text-xs text-white/40 border border-white/10 rounded-full px-3 py-1.5 hover:border-white/30 hover:text-white/70 transition-colors"
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

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/5">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  )
}
