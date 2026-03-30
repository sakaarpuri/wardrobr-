'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { VoiceStyler } from '@/components/voice/VoiceStyler'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useChatStore } from '@/store/chatStore'
import { BUDGET_OPTIONS, SHOPPING_FOR_OPTIONS, getSizeOptions, isSizeCompatibleWithGender } from '@/lib/shopper'
import { EXAMPLE_BOARDS } from '@/lib/exampleBoards'

export default function StylePage() {
  const { clearChat, isLoading, messages, pendingMessage, pendingVoiceStart, setPendingVoiceStart, userProfile, setUserProfile } = useChatStore()
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  const hasShoppableResults = messages.some((message) =>
    message.type === 'ai_product_stream' ||
    message.type === 'ai_outfit_board'
  )
  const showSideRail = hasShoppableResults || (!isLoading && !pendingMessage && messages.length === 0)
  const sizeOptions = getSizeOptions(userProfile.gender)
  const shouldAutoStartVoice = pendingVoiceStart && !pendingMessage

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,215,255,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(232,169,74,0.08),transparent_26%)]" />

      <header className="relative z-10 flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-[var(--text)]">
          Wardrobr.ai
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 px-4 py-4 sm:px-6 sm:py-6">
        <div className={`mx-auto grid gap-4 ${showSideRail ? 'max-w-7xl lg:grid-cols-[320px_minmax(0,1fr)]' : 'max-w-5xl'}`}>
          {showSideRail && (
            <aside className="hidden space-y-4 lg:block">
              <VoiceStyler
                autoStart={Boolean(shouldAutoStartVoice && isDesktop === true)}
                onAutoStartHandled={() => setPendingVoiceStart(false)}
              />
              <OptionalDetailsPanel
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                sizeOptions={sizeOptions}
              />
              <StarterBoardsPanel />
            </aside>
          )}

          <section className="order-1 min-h-[70vh] overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/88 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:rounded-[32px]">
            <ChatInterface />
          </section>

          {showSideRail && (
            <div className="order-2 space-y-3 lg:hidden">
              <MobileAccordion
                label="Voice"
                title="Talk through a tweak"
                subtitle="Keep results in view, then open this when you want to change something."
              >
                <VoiceStyler
                  compact
                  autoStart={Boolean(shouldAutoStartVoice && isDesktop === false)}
                  onAutoStartHandled={() => setPendingVoiceStart(false)}
                />
              </MobileAccordion>

              <MobileAccordion
                label="Optional details"
                title="Budget, size, shopping for"
                subtitle="Only add these if you want sharper picks."
              >
                <OptionalDetailsPanel
                  userProfile={userProfile}
                  setUserProfile={setUserProfile}
                  sizeOptions={sizeOptions}
                  compact
                />
              </MobileAccordion>

              <MobileAccordion
                label="Starter boards"
                title="Open an exact example look"
                subtitle="Useful if you want to compare against a finished board."
              >
                <StarterBoardsPanel compact />
              </MobileAccordion>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

interface UserProfileValue {
  budget: string | null
  budgetMax: number | null
  gender: 'women' | 'men' | null
  size: string | null
}

interface OptionalDetailsPanelProps {
  userProfile: UserProfileValue
  setUserProfile: (patch: Partial<UserProfileValue>) => void
  sizeOptions: string[]
  compact?: boolean
}

function OptionalDetailsPanel({ userProfile, setUserProfile, sizeOptions, compact = false }: OptionalDetailsPanelProps) {
  return (
    <section className={`rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/85 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
            Optional details
          </p>
          <h2 className={`mt-2 font-semibold text-[var(--text)] ${compact ? 'text-base' : 'text-lg'}`}>Add a few details</h2>
        </div>
        <span className="text-[11px] text-[var(--text-faint)]">Optional</span>
      </div>

      <div className={`space-y-4 ${compact ? 'mt-3' : 'mt-4'}`}>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Budget</p>
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map((budget) => (
              <button
                key={budget}
                onClick={() => setUserProfile({
                  budget: userProfile.budget === budget ? null : budget,
                  budgetMax: null,
                })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  userProfile.budget === budget
                    ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                    : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                }`}
              >
                {budget}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Shopping for</p>
          <div className="flex flex-wrap gap-2">
            {SHOPPING_FOR_OPTIONS.map((gender) => {
              const nextGender = gender.toLowerCase() as 'women' | 'men'
              const isActive = userProfile.gender === nextGender
              return (
                <button
                  key={gender}
                  onClick={() => {
                    const resolvedGender = isActive ? null : nextGender
                    setUserProfile({
                      gender: resolvedGender,
                      size: isSizeCompatibleWithGender(userProfile.size, resolvedGender) ? userProfile.size : null,
                    })
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                    isActive
                      ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                      : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                  }`}
                >
                  {gender}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            {userProfile.gender === 'men' ? "Men's size" : userProfile.gender === 'women' ? "Women's size" : 'Size'}
          </p>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((size) => (
              <button
                key={size}
                onClick={() => setUserProfile({ size: userProfile.size === size ? null : size })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  userProfile.size === size
                    ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                    : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function StarterBoardsPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/85 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm ${compact ? 'p-4' : 'p-5'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
        Starter Boards
      </p>
      <div className={`${compact ? 'mt-3' : 'mt-4'} space-y-3`}>
        {EXAMPLE_BOARDS.map((board) => (
          <Link
            key={board.id}
            href={`/board/${board.id}`}
            className={`flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] transition-all hover:border-[#E8A94A]/30 hover:bg-[var(--bg-card)] ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
          >
            <div>
              <p className={`font-semibold text-[var(--text)] ${compact ? 'text-[15px]' : 'text-sm'}`}>{board.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                {board.board.products.length}-piece look · {board.board.totalPrice ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(board.board.totalPrice) : ''}
              </p>
            </div>
            <span className="text-xs text-[var(--text-faint)]">Open</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

interface MobileAccordionProps {
  label: string
  title: string
  subtitle: string
  children: ReactNode
}

function MobileAccordion({ label, title, subtitle, children }: MobileAccordionProps) {
  return (
    <details className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)]/88 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <summary className="list-none cursor-pointer px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">{label}</p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--text)]">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-subtle)]">
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
        </div>
      </summary>
      <div className="border-t border-[var(--border)] px-3 pb-3 pt-2">
        {children}
      </div>
    </details>
  )
}
