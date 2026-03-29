'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { track } from '@/lib/posthog'
import { ClarificationPrompt, Message, Product } from '@/lib/types'
import { getBudgetLabel, getMissionTitle, getTripPreferenceTitle, inferProfileFromReply, isLikelyClarificationReply, normaliseUserProfile } from '@/lib/shopper'

const STARTER_REQUESTS = [
  'Trip to India in summer',
  'Wedding guest look under £150',
  'Find me one hero blazer for work',
  'Match this photo for less',
]

function getLatestUserRequest(messages: Message[]): string | null {
  return [...messages]
    .reverse()
    .find((message) => message.type === 'user_text' && message.content?.trim())
    ?.content
    ?.trim() ?? null
}

export function ChatInterface() {
  const {
    messages,
    isLoading,
    addMessage,
    setLoading,
    setCurrentBoard,
    setOccasionContext,
    userProfile,
    setUserProfile,
    pendingMessage,
    setPendingMessage,
    occasionContext,
    updateMessage,
  } = useChatStore()

  const bottomRef = useRef<HTMLDivElement>(null)
  const hasFiredPending = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    imagePreview?: string,
    options?: {
      silent?: boolean
      overrideProfile?: Partial<typeof userProfile>
      resolvedClarificationId?: string
      overrideText?: string
    }
  ) => {
    let productStreamId: string | null = null
    const lastAssistantText = [...messages].reverse().find((message) => message.type === 'ai_text' || message.type === 'ai_clarification')?.content ?? null
    const inferredProfilePatch = text ? inferProfileFromReply(text, userProfile, lastAssistantText) : {}
    const effectiveProfile = {
      ...normaliseUserProfile(userProfile),
      ...inferredProfilePatch,
      ...(options?.overrideProfile ?? {}),
    }
    const isClarificationReply = text ? isLikelyClarificationReply(text, userProfile, lastAssistantText) : false
    const requestText = options?.overrideText ?? ((isClarificationReply && occasionContext) ? occasionContext : text)

    if (Object.keys(inferredProfilePatch).length > 0) {
      setUserProfile(inferredProfilePatch)
    }

    if (requestText && !options?.silent && !isClarificationReply) {
      setOccasionContext(requestText)
    }

    if (messages.length === 0 && requestText) {
      track('session_started', { occasion: requestText })
    }

    if (!options?.silent && imageBase64) {
      addMessage({ type: 'user_image', content: text || undefined, imageUrl: imagePreview, imageBase64 })
    } else if (!options?.silent && text) {
      addMessage({ type: 'user_text', content: text })
    }

    const loadingMsg = addMessage({ type: 'system_loading' })
    setLoading(true)

    try {
      const history = messages
        .filter((message) => message.type === 'user_text' || message.type === 'ai_text' || message.type === 'ai_clarification')
        .map((message) => ({
          role: message.type === 'user_text' ? 'user' : 'model',
          parts: [{ text: message.content ?? '' }],
        }))

      const response = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: requestText || (imageBase64 ? 'Please style this look and find me similar purchasable items.' : ''),
          imageBase64,
          imageMimeType,
          history,
          profile: effectiveProfile,
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
            clarification?: ClarificationPrompt
            hasBoard?: boolean
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
              messages: state.messages.filter((message) =>
                message.id !== loadingMsg.id &&
                message.id !== sid &&
                message.id !== options?.resolvedClarificationId
              ),
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
              track('board_generated', { occasion_type: event.outfitBoard.occasion })
            }
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'Unknown error')
          }
        }
      }
    } catch (error) {
      useChatStore.setState((state) => ({
        messages: state.messages.filter((message) => message.id !== loadingMsg.id),
      }))
      addMessage({
        type: 'ai_text',
        content: error instanceof Error ? error.message : "Sorry, I couldn't process that request. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClarificationSelect = (message: Message, groupId: string, optionId: string) => {
    const clarification = message.clarification
    if (!clarification || clarification.isSubmitting) return

    const nextGroups = clarification.groups.map((group) =>
      group.id === groupId ? { ...group, selectedOptionId: optionId } : group
    )
    const nextClarification: ClarificationPrompt = { ...clarification, groups: nextGroups }
    updateMessage(message.id, { clarification: nextClarification })

    const allSelected = nextGroups.every((group) => group.selectedOptionId)
    if (!allSelected) return

    const profilePatch = nextGroups.reduce<Partial<typeof userProfile>>((patch, group) => {
      const selected = group.options.find((option) => option.id === group.selectedOptionId)
      if (!selected?.profilePatch) return patch
      return { ...patch, ...selected.profilePatch }
    }, {})

    if (Object.keys(profilePatch).length > 0) {
      setUserProfile(profilePatch)
    }

    updateMessage(message.id, {
      clarification: {
        ...nextClarification,
        isSubmitting: true,
      },
    })

    const baseRequest = occasionContext ?? getLatestUserRequest(messages)

    handleSend('', undefined, undefined, undefined, {
      silent: true,
      overrideProfile: profilePatch,
      resolvedClarificationId: message.id,
      overrideText: baseRequest ?? undefined,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'thin' }}>
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {(userProfile.mission || userProfile.tripPreference || userProfile.budget || userProfile.budgetMax || userProfile.size || userProfile.gender || userProfile.shoeSize || userProfile.occasionStrictness || userProfile.fitNotes) && (
            <div className="flex flex-wrap gap-2">
              {userProfile.mission && (
                <span className="rounded-full border border-[#E8A94A]/30 bg-[#E8A94A]/10 px-3 py-1 text-[11px] text-[#E8A94A]">
                  {getMissionTitle(userProfile.mission)}
                </span>
              )}
              {userProfile.tripPreference && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                  {getTripPreferenceTitle(userProfile.tripPreference)}
                </span>
              )}
              {getBudgetLabel(userProfile) && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                  {userProfile.budgetScope === 'per_item' ? 'Per item' : 'Budget'} {getBudgetLabel(userProfile)}
                </span>
              )}
              {userProfile.size && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                  Size {userProfile.size}
                </span>
              )}
              {userProfile.gender && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                  Shopping for {userProfile.gender}
                </span>
              )}
            </div>
          )}

          {messages.length === 0 && (
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-subtle)]/88 p-5 backdrop-blur-sm">
              <p className="text-sm font-semibold text-[var(--text)]">Voice is the main way in here.</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
                Speak to the stylist from the panel on the left, or type a quick brief below if that is easier right now.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STARTER_REQUESTS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs text-[var(--text-muted)] transition-all hover:border-[#E8A94A]/35 hover:text-[var(--text)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onClarificationSelect={handleClarificationSelect}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--bg-card)]/92 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            placeholder={messages.length > 0 ? 'Type a quick follow-up if speaking is awkward...' : 'Type instead if needed...'}
          />
        </div>
      </div>
    </div>
  )
}
