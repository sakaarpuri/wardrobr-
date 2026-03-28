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
      if (!response.body) throw new Error('No response body')

      // Read the SSE stream — each event updates the loading indicator or delivers the result
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
          let event: { type: string; text?: string; outfitBoard?: import('@/lib/types').OutfitBoard; hasBoard?: boolean; error?: string }
          try {
            event = JSON.parse(chunk.slice(6))
          } catch {
            continue
          }

          if (event.type === 'status' && event.text) {
            // Update the loading bubble text in-place — user sees live progress
            useChatStore.setState((state) => ({
              messages: state.messages.map((m) =>
                m.id === loadingMsg.id ? { ...m, content: event.text } : m
              ),
            }))
          } else if (event.type === 'result') {
            // Remove loading message, add final response
            useChatStore.setState((state) => ({
              messages: state.messages.filter((m) => m.id !== loadingMsg.id),
            }))

            if (event.text) {
              addMessage({ type: 'ai_text', content: event.text })
            }
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
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 px-4">
            <div className="space-y-2">
              <p className="text-white/70 text-base font-medium">What are you dressing for?</p>
              <p className="text-white/35 text-sm max-w-xs leading-relaxed">
                Tell me the occasion, your budget, and when it is. I&apos;ll build the complete shoppable outfit.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {[
                'Summer wedding guest',
                'New job, first week',
                'Holiday capsule',
                'Post-breakup refresh',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="text-xs text-white/55 border border-white/15 rounded-full px-4 py-2 hover:border-white/35 hover:text-white/80 hover:bg-white/5 transition-all"
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
