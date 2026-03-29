'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { VoiceStyler } from '@/components/voice/VoiceStyler'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useChatStore } from '@/store/chatStore'
import { BUDGET_OPTIONS, SHOPPING_FOR_OPTIONS, SIZE_OPTIONS } from '@/lib/shopper'
import { EXAMPLE_BOARDS } from '@/lib/exampleBoards'

export default function StylePage() {
  const { clearChat, messages, userProfile, setUserProfile } = useChatStore()

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
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <VoiceStyler />

            <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
                    Quick Controls
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Tighten the brief</h2>
                </div>
                <span className="text-[11px] text-[var(--text-faint)]">Optional</span>
              </div>

              <div className="mt-4 space-y-4">
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
                    {SHOPPING_FOR_OPTIONS.map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setUserProfile({ gender: userProfile.gender === gender.toLowerCase() as 'women' | 'men' ? null : gender.toLowerCase() as 'women' | 'men' })}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                          userProfile.gender === gender.toLowerCase()
                            ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                            : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {SIZE_OPTIONS.map((size) => (
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

            <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
                Starter Boards
              </p>
              <div className="mt-4 space-y-3">
                {EXAMPLE_BOARDS.map((board) => (
                  <Link
                    key={board.id}
                    href={`/board/${board.id}`}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 transition-all hover:border-[#E8A94A]/30 hover:bg-[var(--bg-card)]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{board.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        {board.board.products.length}-piece look · {board.board.totalPrice ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(board.board.totalPrice) : ''}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--text-faint)]">Open</span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>

          <section className="min-h-[70vh] overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--bg-card)]/88 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <ChatInterface />
          </section>
        </div>
      </main>
    </div>
  )
}
