'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { ChatMessage } from './ChatMessage'
import { track } from '@/lib/posthog'
import { ClarificationPrompt, Message, Product } from '@/lib/types'
import { buildWorkingSummary, getBudgetLabel, getMissionTitle, getTripPreferenceTitle, inferProfileFromReply, isLikelyClarificationReply, normaliseUserProfile } from '@/lib/shopper'
import { recordMemberEvent } from '@/lib/member-memory-client'

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
    currentBoard,
    trackSessionSignal,
  } = useChatStore()

  const bottomRef = useRef<HTMLDivElement>(null)
  const lastPendingMessageRef = useRef<typeof pendingMessage>(null)
  const isBootingFromHomepage = Boolean(pendingMessage) || (isLoading && messages.length === 0)
  const latestUserTextMessage = [...messages]
    .reverse()
    .find((message) => message.type === 'user_text' && message.content?.trim())
  const latestVoiceMessage = latestUserTextMessage?.source === 'voice' ? latestUserTextMessage : null
  const activeRequestText = occasionContext ?? pendingMessage?.text ?? getLatestUserRequest(messages)
  const workingSummary = buildWorkingSummary(activeRequestText, userProfile)
  const hiddenLatestTypedRequestId =
    latestUserTextMessage &&
    latestUserTextMessage.source !== 'voice' &&
    activeRequestText &&
    latestUserTextMessage.content?.trim().toLowerCase() === activeRequestText.trim().toLowerCase()
      ? latestUserTextMessage.id
      : null
  const visibleMessages = messages.filter((message) => message.id !== hiddenLatestTypedRequestId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      anchorProduct?: Product
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

    if (currentBoard && requestText && !options?.silent) {
      trackSessionSignal('followup_prompt_accepted', { board: currentBoard })
    }

    if (messages.length === 0 && requestText) {
      track('session_started', { occasion: requestText })
    }

    if (!options?.silent && imageBase64) {
      addMessage({ type: 'user_image', content: text || undefined, imageUrl: imagePreview, imageBase64 })
    } else if (!options?.silent && text) {
      addMessage({ type: 'user_text', content: text, source: 'typed' })
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
          currentBoard,
          anchorProduct: options?.anchorProduct,
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
              setCurrentBoard(event.outfitBoard, { preserveSelection: true })
              trackSessionSignal('board_generated', { board: event.outfitBoard })
              track('board_generated', { occasion_type: event.outfitBoard.occasion })
              void recordMemberEvent('board_generated', {
                boardId: event.outfitBoard.id,
                metadata: {
                  title: event.outfitBoard.title,
                  occasion: event.outfitBoard.occasion ?? null,
                  totalPrice: event.outfitBoard.totalPrice ?? null,
                },
              })
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

  useEffect(() => {
    if (pendingMessage && pendingMessage !== lastPendingMessageRef.current) {
      lastPendingMessageRef.current = pendingMessage
      const { text, imageBase64, imageMimeType, imagePreview, anchorProduct } = pendingMessage
      setPendingMessage(null)
      void handleSend(text, imageBase64, imageMimeType, imagePreview, { anchorProduct })
    }
    // handleSend is intentionally excluded here so a new function instance
    // does not re-fire the same pending request on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, setPendingMessage])

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
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5" style={{ scrollbarWidth: 'thin' }}>
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {workingSummary && (
            <div className="rounded-[24px] border border-[rgba(82,126,255,0.14)] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,244,255,0.88))] px-4 py-3.5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                Working on
              </p>
              <p className="mt-2 text-[15px] font-medium leading-relaxed text-[var(--text)] sm:text-sm">
                {workingSummary}
              </p>
              {latestVoiceMessage?.content && (
                <details className="mt-3">
                  <summary className="cursor-pointer list-none text-[12px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/72 px-3 py-1.5">
                      Show what I heard
                    </span>
                  </summary>
                  <p className="mt-2 rounded-[18px] border border-[var(--border)] bg-white/70 px-3.5 py-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {latestVoiceMessage.content}
                  </p>
                </details>
              )}
            </div>
          )}

          {(userProfile.mission || userProfile.tripPreference || userProfile.budget || userProfile.budgetMax || userProfile.size || userProfile.gender || userProfile.shoeSize || userProfile.occasionStrictness || userProfile.fitNotes) && (
            <div className="flex flex-wrap gap-2">
              {userProfile.mission && (
                <span className="rounded-full border border-[#E8A94A]/30 bg-[#E8A94A]/10 px-3 py-1.5 text-xs text-[#E8A94A] sm:py-1 sm:text-[11px]">
                  {getMissionTitle(userProfile.mission)}
                </span>
              )}
              {userProfile.tripPreference && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] sm:py-1 sm:text-[11px]">
                  {getTripPreferenceTitle(userProfile.tripPreference)}
                </span>
              )}
              {getBudgetLabel(userProfile) && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] sm:py-1 sm:text-[11px]">
                  {userProfile.budgetScope === 'per_item' ? 'Per item' : 'Budget'} {getBudgetLabel(userProfile)}
                </span>
              )}
              {userProfile.size && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] sm:py-1 sm:text-[11px]">
                  Size {userProfile.size}
                </span>
              )}
              {userProfile.gender && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] sm:py-1 sm:text-[11px]">
                  Shopping for {userProfile.gender}
                </span>
              )}
            </div>
          )}

          {messages.length === 0 && !isBootingFromHomepage && (
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-subtle)]/88 p-5 backdrop-blur-sm">
              <p className="text-base font-semibold text-[var(--text)] sm:text-sm">Start with one clear shopping ask.</p>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-sm">
                Use the mic or type a brief and I&apos;ll turn it into a shortlist or full look you can actually compare and shop.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STARTER_REQUESTS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2 text-sm text-[var(--text-muted)] transition-all hover:border-[#E8A94A]/35 hover:text-[var(--text)] sm:py-1.5 sm:text-xs"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length === 0 && isBootingFromHomepage && (
            <div className="rounded-[28px] border border-[rgba(82,126,255,0.16)] bg-[linear-gradient(145deg,rgba(82,126,255,0.10),rgba(255,255,255,0.92))] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
                Looking now
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)] sm:text-lg">Pulling together your first picks</h2>
              {workingSummary && (
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-sm">
                  {workingSummary}
                </p>
              )}
            </div>
          )}

          {visibleMessages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onClarificationSelect={handleClarificationSelect}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
