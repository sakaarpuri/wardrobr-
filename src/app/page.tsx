'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { Camera, Mic, Send, Sparkles, Wand2 } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthStatus } from '@/components/auth/AuthStatus'
import { EmbeddedStyleWorkspace } from '@/components/workspace/StyleWorkspace'
import { VoiceStyler } from '@/components/voice/VoiceStyler'
import { EXAMPLE_BOARDS } from '@/lib/exampleBoards'
import { APP_BUILD_LABEL } from '@/lib/version'

const SPOKEN_PROMPTS = [
  'I need a night out look, under sixty quid',
  'Find me a wedding guest outfit under one-fifty',
  'Trip to India in summer',
  'Style these trainers for a city break',
]

const OCCASIONS = [
  'Summer wedding',
  'Job interview',
  'First date',
  'Weekend brunch',
  'Gallery opening',
  'Garden party',
  'Business casual',
  'Holiday capsule',
  'Night out',
  'Dinner party',
]

const CAPABILITIES = [
  {
    title: 'Talk',
    body: 'Say the brief naturally and let the stylist turn it into a shopping plan.',
    icon: Mic,
  },
  {
    title: 'Photo',
    body: 'Drop in a look you love and match the feel with real products.',
    icon: Camera,
  },
  {
    title: 'Refine',
    body: 'Tighten budget, size, or vibe once the first results land.',
    icon: Wand2,
  },
]

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

function HomeHero({
  onSubmit,
  onStartVoice,
  expanded = false,
  autoStartVoice = false,
  onAutoStartHandled,
  children,
}: {
  onSubmit: (message: string, imageBase64?: string, imageMimeType?: string, imagePreview?: string) => void
  onStartVoice: () => void
  expanded?: boolean
  autoStartVoice?: boolean
  onAutoStartHandled?: () => void
  children?: ReactNode
}) {
  const [text, setText] = useState('')
  const [showTypedFallback, setShowTypedFallback] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => onSubmit(text)

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      onSubmit(text || 'Style this look and find me similar purchasable items.', base64, file.type, dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className={`w-full rounded-[36px] border border-[rgba(82,126,255,0.16)] bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(240,235,225,0.82))] shadow-[0_30px_110px_rgba(15,23,42,0.10)] backdrop-blur-xl ${expanded ? 'max-w-7xl p-4 sm:p-5' : 'max-w-4xl p-4 sm:p-6'}`}>
      <div className={`space-y-6 ${expanded ? 'space-y-4' : ''}`}>
        {!expanded && (
          <div className="mx-auto max-w-2xl text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
                Voice-first stylist
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                Start with your voice, then refine if you want to.
              </h2>
            </div>
            <p className="mt-3 text-xs text-[var(--text-faint)]">
              The quickest route in is the mic. Typing and photo matching stay here as backup.
            </p>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

        {!expanded ? (
          <button
            onClick={onStartVoice}
            className="relative w-full overflow-hidden rounded-[32px] border border-[rgba(72,134,255,0.20)] bg-[linear-gradient(135deg,rgba(82,126,255,0.18),rgba(104,220,255,0.14),rgba(255,255,255,0.24))] px-5 py-6 text-center transition-all hover:border-[rgba(72,134,255,0.34)] hover:shadow-[0_24px_80px_rgba(49,98,255,0.14)] sm:px-8 sm:py-8"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,215,255,0.24),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,211,144,0.20),transparent_36%)]" />
            <div className="relative flex flex-col items-center justify-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(82,126,255,0.22)] bg-white/72 backdrop-blur-sm sm:h-24 sm:w-24">
                <span className="absolute inset-[-10px] rounded-full border border-[rgba(82,126,255,0.18)]" />
                <Mic className="h-8 w-8 text-[var(--text)]" />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight text-[var(--text)]">
                  Tap to talk to your stylist
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
                  Say the trip, event, vibe, or one item you need. I&apos;ll start listening and pull the first picks together right here.
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <VoiceStyler compact engaged autoStart={autoStartVoice} onAutoStartHandled={onAutoStartHandled} showTypedFallback={false} />
            <div className="rounded-[28px] border border-[var(--border)] bg-white/72 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm sm:px-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                    Type / add a photo
                  </p>
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Refine the picks here..."
                  rows={2}
                  className="min-h-[72px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
                  style={{ scrollbarWidth: 'none' }}
                />

                <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload a photo"
                    className="flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                  >
                    <Camera className="h-4 w-4" />
                    Photo
                  </button>

                  <button
                    onClick={handleSend}
                    disabled={!text.trim()}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all ${
                      text.trim() ? 'bg-[#E8A94A] text-[#1A0E00] hover:bg-[#f0b85a]' : 'cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--text-faint)]'
                    }`}
                  >
                    Update picks
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`space-y-3 ${expanded ? 'hidden sm:hidden' : ''}`}>
          <div className="hidden rounded-[28px] border border-[var(--border)] bg-white/72 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm sm:block sm:px-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                  Or type / add a photo
                </p>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Or type here..."
                rows={2}
                className="min-h-[72px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
                style={{ scrollbarWidth: 'none' }}
              />

              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload a photo"
                    className="flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                  >
                    <Camera className="h-4 w-4" />
                    Photo
                  </button>
                </div>

                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all ${
                    text.trim() ? 'bg-[#E8A94A] text-[#1A0E00] hover:bg-[#f0b85a]' : 'cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--text-faint)]'
                  }`}
                >
                  See my picks
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="sm:hidden">
            {!showTypedFallback ? (
              <button
                onClick={() => setShowTypedFallback(true)}
                className="rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                Or type instead
              </button>
            ) : (
              <div className="rounded-[24px] border border-[var(--border)] bg-white/72 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Or type here..."
                  rows={2}
                  className="min-h-[72px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                  >
                    <Camera className="h-4 w-4" />
                    Photo
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!text.trim()}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all ${
                      text.trim() ? 'bg-[#E8A94A] text-[#1A0E00]' : 'cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--text-faint)]'
                    }`}
                  >
                    See picks
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {!expanded && (
          <div className="space-y-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
              Or try saying...
            </p>
            <div className="flex flex-wrap gap-2">
              {SPOKEN_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSubmit(prompt)}
                  className="rounded-full border border-[var(--border)] bg-white/78 px-3.5 py-1.5 text-xs text-[var(--text-muted)] transition-all hover:border-[#E8A94A]/50 hover:bg-[#E8A94A]/5 hover:text-[#E8A94A]"
                >
                  “{prompt}”
                </button>
              ))}
            </div>
          </div>
        )}

        {expanded && children ? (
          <div className="border-t border-[rgba(82,126,255,0.12)] pt-4 sm:pt-5">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProofBoard() {
  const board = EXAMPLE_BOARDS[1] ?? EXAMPLE_BOARDS[0]

  return (
    <section className="px-6 pb-6">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[0_20px_70px_rgba(15,23,42,0.07)] sm:p-5">
        <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-md">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--text-faint)]">What you&apos;ll get</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)] sm:text-xl">Your look, ready to shop.</h2>
          </div>
          <p className="max-w-sm text-[13px] leading-relaxed text-[var(--text-muted)] sm:text-sm">
            The result is a real board with product cards, live prices, store links, and a total, not a vague moodboard.
          </p>
        </div>

        <div className="mt-4 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5 sm:p-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {board.board.products.slice(0, 4).map((product) => (
                <div key={product.id} className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)]">
                  <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg-subtle)]">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 45vw, 20vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">{product.brand}</p>
                    <p className="line-clamp-2 text-[11px] font-medium leading-snug text-[var(--text)]">{product.name}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-semibold text-[var(--text)]">{formatPrice(product.price)}</span>
                      <span className="text-[10px] text-[var(--text-faint)]">Shop</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-[var(--border)] bg-[linear-gradient(145deg,rgba(82,126,255,0.10),rgba(255,255,255,0.85))] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">Example result</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text)]">{board.title}</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-muted)] sm:text-sm">{board.board.styleNote}</p>

            <div className="mt-3.5 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white/70 px-3 py-2">
                <span className="text-[var(--text-muted)]">Stores</span>
                <span className="font-medium text-[var(--text)]">ASOS, Zara, H&amp;M, more</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white/70 px-3 py-2">
                <span className="text-[var(--text-muted)]">Pieces</span>
                <span className="font-medium text-[var(--text)]">{board.board.products.length} shoppable picks</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white/70 px-3 py-2">
                <span className="text-[var(--text-muted)]">Total</span>
                <span className="font-medium text-[var(--text)]">{formatPrice(board.board.totalPrice ?? 0)}</span>
              </div>
            </div>

            <Link
              href={`/board/${board.id}`}
              className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-[#E8A94A]/40"
            >
              See exact example board
              <Sparkles className="h-4 w-4 text-[#E8A94A]" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function OccasionTicker({ onSubmit }: { onSubmit: (message: string) => void }) {
  return (
    <section className="px-6 pb-10">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-[var(--text-faint)]">Occasions we can sort</p>
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {OCCASIONS.map((occasion) => (
            <button
              key={occasion}
              onClick={() => onSubmit(`${occasion} outfit`)}
              className="whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-muted)] transition-all hover:border-[#E8A94A]/45 hover:text-[var(--text)]"
            >
              {occasion}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function CapabilityStrip() {
  return (
    <section className="px-6 pb-20">
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
        {CAPABILITIES.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(82,126,255,0.16)] bg-[linear-gradient(135deg,rgba(82,126,255,0.12),rgba(104,220,255,0.08))]">
                <Icon className="h-4 w-4 text-[var(--text)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{item.body}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MemberMemoryCard() {
  return (
    <section className="px-6 pb-12">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-[rgba(82,126,255,0.16)] bg-[linear-gradient(145deg,rgba(82,126,255,0.12),rgba(255,255,255,0.92),rgba(232,169,74,0.10))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/65 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
              <Sparkles className="h-3.5 w-3.5 text-[#E8A94A]" />
              AI taste memory
            </div>
            <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
              The shopping agent learns your taste as you use it over time.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
              Signed-in members keep a cleaner memory of the brands, price tiers, silhouettes, and boards they actually respond to, so the next set of picks starts closer to their taste.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/55 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <div className="space-y-3">
              {[
                'Learns from shop clicks, saves, swaps, and open-all-tabs',
                'Biases future results gently instead of boxing you in',
                'Keeps member memory separate from guest sessions',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/80 px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [workspaceOpened, setWorkspaceOpened] = useState(false)
  const [workspaceRequested] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('workspace') === '1'
  })
  const { setPendingMessage, setPendingVoiceStart, clearChat, setOccasionContext, messages, pendingMessage, pendingVoiceStart, isLoading } = useChatStore()
  const workspaceVisible = workspaceRequested || workspaceOpened || pendingVoiceStart || Boolean(pendingMessage) || isLoading || messages.length > 0

  useEffect(() => {
    if (!workspaceVisible) return
    const timer = window.setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)

    return () => window.clearTimeout(timer)
  }, [workspaceVisible])

  const handleSubmit = (message: string, imageBase64?: string, imageMimeType?: string, imagePreview?: string) => {
    if (!message.trim() && !imageBase64) return
    clearChat()
    setWorkspaceOpened(true)
    setPendingVoiceStart(false)
    if (message.trim()) {
      setOccasionContext(message.trim())
    }
    setPendingMessage({ text: message.trim(), imageBase64, imageMimeType, imagePreview })
  }

  const handleStartVoice = () => {
    clearChat()
    setWorkspaceOpened(true)
    setOccasionContext(null)
    setPendingMessage(null)
    setPendingVoiceStart(true)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col overflow-hidden">
      <nav className="relative z-10 flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <div className="leading-none">
          <span className="block text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">Wardrobr.ai</span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.32em] text-[var(--text-faint)]">Sorted</span>
        </div>
        <div className="flex items-center gap-2">
          <AuthStatus />
          <ThemeToggle />
        </div>
      </nav>

      <main className={`relative px-6 pt-14 text-center sm:pt-18 ${workspaceVisible ? 'pb-4 sm:pb-3' : 'pb-10'}`}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />
        <div
          className="animate-breathe absolute pointer-events-none"
          style={{
            top: '28%',
            left: '50%',
            width: '560px',
            height: '380px',
            background: 'radial-gradient(ellipse, rgba(253,230,200,0.055) 0%, rgba(220,180,160,0.025) 50%, transparent 75%)',
            borderRadius: '50%',
            filter: 'blur(40px)',
            transformOrigin: 'center center',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '16%',
            right: '8%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(102,199,255,0.14) 0%, rgba(102,199,255,0.05) 42%, transparent 72%)',
            filter: 'blur(18px)',
          }}
        />

        <div className={`relative z-10 mx-auto flex w-full flex-col items-center ${workspaceVisible ? 'max-w-7xl' : 'max-w-4xl'}`}>
          <div className="max-w-3xl">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-[var(--text)] sm:text-6xl">
              Tell me what you&apos;re dressing for and I&apos;ll find a full shoppable outfit in seconds.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
              Start free · Member taste memory when you join · Real products from ASOS, H&amp;M, Zara &amp; more
            </p>
          </div>

          <div ref={workspaceRef} className={`mt-8 flex w-full justify-center ${workspaceVisible ? 'max-w-7xl' : ''}`}>
            <HomeHero
              onSubmit={handleSubmit}
              onStartVoice={handleStartVoice}
              expanded={workspaceVisible}
              autoStartVoice={pendingVoiceStart}
              onAutoStartHandled={() => setPendingVoiceStart(false)}
            >
              {workspaceVisible ? <EmbeddedStyleWorkspace /> : null}
            </HomeHero>
            <Script src="https://sovrn.co/zs04ts3" strategy="afterInteractive" />
          </div>
        </div>
      </main>

      {workspaceVisible ? null : (
        <>
          <ProofBoard />
          <OccasionTicker onSubmit={handleSubmit} />
          <CapabilityStrip />
        </>
      )}
      <MemberMemoryCard />

      <div className="border-t border-[var(--border)] px-6 py-3 text-center">
        <p className="mx-auto max-w-xl text-xs leading-relaxed text-[var(--text-faint)]">
          We earn a commission on purchases made through links on this site, at no extra cost to you.{` `}
          <Link href="/about" className="text-[var(--text-muted)] underline underline-offset-2 transition-colors hover:text-[#E8A94A]">
            Learn more
          </Link>
        </p>
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4">
        <span className="text-xs text-[var(--text-faint)]">© 2026 Wardrobr.ai · {APP_BUILD_LABEL}</span>
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]">About</Link>
          <Link href="/privacy" className="text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]">Privacy</Link>
          <a href="https://sovrn.co/zs04ts3" className="text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]">Affiliate links</a>
        </div>
      </footer>
    </div>
  )
}
