'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { track } from '@/lib/posthog'
import { ClarificationPrompt, Message, Product } from '@/lib/types'
import { BUDGET_OPTIONS, MISSION_OPTIONS, SHOPPING_FOR_OPTIONS, SIZE_OPTIONS, getMissionTitle, getTripPreferenceTitle, inferProfileFromReply, isLikelyClarificationReply, normaliseUserProfile } from '@/lib/shopper'

export function ChatInterface() {
  const {
    messages, isLoading,
    addMessage, setLoading, setCurrentBoard, setOccasionContext,
    userProfile, setUserProfile,
    pendingMessage, setPendingMessage,
    occasionContext, updateMessage,
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
    const requestText = options?.overrideText
      ?? ((isClarificationReply && occasionContext) ? occasionContext : text)

    if (Object.keys(inferredProfilePatch).length > 0) {
      setUserProfile(inferredProfilePatch)
    }

    if (requestText && !options?.silent && !isClarificationReply) {
      setOccasionContext(requestText)
    }

    if (messages.length === 0 && requestText) track('session_started', { occasion: requestText })

    if (!options?.silent && imageBase64) {
      addMessage({ type: 'user_image', content: text || undefined, imageUrl: imagePreview, imageBase64 })
    } else if (!options?.silent && text) {
      addMessage({ type: 'user_text', content: text })
    }

    const loadingMsg = addMessage({ type: 'system_loading' })
    setLoading(true)

    try {
      const history = messages
        .filter((m) => m.type === 'user_text' || m.type === 'ai_text' || m.type === 'ai_clarification')
        .map((m) => ({
          role: m.type === 'user_text' ? 'user' : 'model',
          parts: [{ text: m.content ?? '' }],
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
              messages: state.messages.filter((m) =>
                m.id !== loadingMsg.id &&
                m.id !== sid &&
                m.id !== options?.resolvedClarificationId
              ),
            }))
            productStreamId = null
            // Only show text response when there's no board — the board speaks for itself
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
    } catch {
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== loadingMsg.id),
      }))
      addMessage({ type: 'ai_text', content: "Sorry, I couldn't process that request. Please try again." })
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

    handleSend('', undefined, undefined, undefined, {
      silent: true,
      overrideProfile: profilePatch,
      resolvedClarificationId: message.id,
      overrideText: occasionContext ?? undefined,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {(userProfile.mission || userProfile.tripPreference || userProfile.budget || userProfile.size || userProfile.gender || userProfile.shoeSize || userProfile.occasionStrictness || userProfile.fitNotes) && (
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
            {userProfile.budget && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                {userProfile.budgetScope === 'per_item' ? 'Per item' : 'Budget'} {userProfile.budget}
              </span>
            )}
            {userProfile.size && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                Size {userProfile.size}
              </span>
            )}
            {userProfile.shoeSize && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                Shoe size {userProfile.shoeSize}
              </span>
            )}
            {userProfile.gender && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                Shopping for {userProfile.gender}
              </span>
            )}
            {userProfile.occasionStrictness && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                {userProfile.occasionStrictness} dress code
              </span>
            )}
            {userProfile.fitNotes && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                Fit notes added
              </span>
            )}
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-4">
            <div className="space-y-1.5">
              <p className="text-[var(--text)] text-base font-medium">Let&apos;s tighten the brief before we search.</p>
              <p className="text-[var(--text-muted)] text-sm max-w-xs leading-relaxed">
                Start with what you want to buy. Budget and size help, and you can refine again after the first results land.
              </p>
            </div>

            {/* Quick profile setup */}
            <div className="w-full max-w-xs space-y-3 text-left">
              <div>
                <p className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1.5">Mission</p>
                <div className="flex flex-wrap gap-2">
                  {MISSION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setUserProfile({ mission: userProfile.mission === option.value ? null : option.value })}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        userProfile.mission === option.value
                          ? 'border-[#E8A94A]/60 text-[#E8A94A] bg-[#E8A94A]/10'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                      }`}
                    >
                      {option.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div>
                <p className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1.5">Shopping for</p>
                <div className="flex gap-2">
                  {SHOPPING_FOR_OPTIONS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setUserProfile({ gender: userProfile.gender === g.toLowerCase() as 'women' | 'men' ? null : g.toLowerCase() as 'women' | 'men' })}
                      className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                        userProfile.gender === g.toLowerCase()
                          ? 'border-[#E8A94A]/60 text-[#E8A94A] bg-[#E8A94A]/10'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <p className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1.5">UK size</p>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setUserProfile({ size: userProfile.size === s ? null : s })}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        userProfile.size === s
                          ? 'border-[#E8A94A]/60 text-[#E8A94A] bg-[#E8A94A]/10'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div>
                <p className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1.5">Budget</p>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((b) => (
                    <button
                      key={b}
                      onClick={() => setUserProfile({ budget: userProfile.budget === b ? null : b })}
                      className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                        userProfile.budget === b
                          ? 'border-[#E8A94A]/60 text-[#E8A94A] bg-[#E8A94A]/10'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  {[
                    { key: 'total', label: 'Total budget' },
                    { key: 'per_item', label: 'Per-item budget' },
                  ].map((scope) => (
                    <button
                      key={scope.key}
                      onClick={() => setUserProfile({ budgetScope: scope.key as 'total' | 'per_item' })}
                      className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                        userProfile.budgetScope === scope.key
                          ? 'border-[#E8A94A]/60 text-[#E8A94A] bg-[#E8A94A]/10'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1.5">Occasion strictness</p>
                  <div className="flex flex-wrap gap-2">
                    {['relaxed', 'balanced', 'strict'].map((strictness) => (
                      <button
                        key={strictness}
                        onClick={() => setUserProfile({ occasionStrictness: userProfile.occasionStrictness === strictness ? null : strictness as 'relaxed' | 'balanced' | 'strict' })}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          userProfile.occasionStrictness === strictness
                            ? 'border-[#E8A94A]/60 text-[#E8A94A] bg-[#E8A94A]/10'
                            : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                        }`}
                      >
                        {strictness}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1.5">Shoe size</p>
                  <input
                    value={userProfile.shoeSize ?? ''}
                    onChange={(e) => setUserProfile({ shoeSize: e.target.value || null })}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-faint)] outline-none focus:border-[var(--border-hover)]"
                  />
                </div>
              </div>

              <div>
                <p className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1.5">Fit notes</p>
                <input
                  value={userProfile.fitNotes ?? ''}
                  onChange={(e) => setUserProfile({ fitNotes: e.target.value || null })}
                  placeholder="Petite, likes room in sleeves, hates clingy fabric..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-faint)] outline-none focus:border-[var(--border-hover)]"
                />
              </div>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 justify-center max-w-sm mt-1">
              {[
                'Wedding guest look under £150',
                'Find me a hero blazer for work',
                'Style these trainers for a city break',
                'Match this photo for less',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-full px-4 py-2 hover:border-[var(--border-hover)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-all"
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

      <div className="px-4 pb-4 pt-2 border-t border-[var(--border)]">
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          placeholder={messages.length > 0 ? 'Something else? Change the budget, occasion, or vibe…' : undefined}
        />
      </div>
    </div>
  )
}
