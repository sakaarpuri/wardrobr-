'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowRight, Camera, Mic, Send } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BUDGET_OPTIONS, MISSION_OPTIONS, SIZE_OPTIONS } from '@/lib/shopper'
import { EXAMPLE_BOARDS } from '@/lib/exampleBoards'

const EXAMPLE_PROMPTS = [
  'Night out, under £60',
  'Summer wedding, £150 max',
  'New job, smart casual',
  'Travel capsule for Las Palmas',
]

const TRUST_POINTS = [
  'Mission first, not a long form',
  'Live product picks from UK stores',
  'Direct retailer links when available',
]

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

// ─── Homepage input component ─────────────────────────────────────────────────

function HomepageInput() {
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { setPendingMessage, clearChat, userProfile, setUserProfile } = useChatStore()

  const submit = (message: string, imageBase64?: string, imageMimeType?: string, imagePreview?: string) => {
    if (!message.trim() && !imageBase64) return
    clearChat()
    setPendingMessage({ text: message.trim(), imageBase64, imageMimeType, imagePreview })
    router.push('/style')
  }

  const handleSend = () => submit(text)

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      submit(text || 'Style this look and find me similar purchasable items.', base64, file.type, dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleMic = () => {
    const SR = (window as typeof window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    setIsListening(true)
    recognition.onresult = (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      const transcript = e.results[0][0].transcript
      setText(transcript)
      setIsListening(false)
      submit(transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  return (
    <div className="w-full max-w-4xl rounded-[32px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[0_26px_90px_rgba(26,14,0,0.08)] sm:p-6">
      <div className="space-y-5">
        <div className="space-y-2 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
            Start Here
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
                Pick the route in, then describe what you need.
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
                Keep it loose if you want. Event, trip, vibe, or one item you need to buy, that is enough to get moving.
              </p>
            </div>
            <p className="text-xs text-[var(--text-faint)] sm:text-right">
              Optional filters stay light until results.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {MISSION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setUserProfile({ mission: userProfile.mission === option.value ? null : option.value })}
              className={`rounded-2xl border p-3.5 text-left transition-all ${
                userProfile.mission === option.value
                  ? 'border-[#E8A94A]/55 bg-[#E8A94A]/10 shadow-[0_0_0_1px_rgba(232,169,74,0.08)]'
                  : 'border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[#E8A94A]/30 hover:bg-[var(--bg)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{option.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{option.body}</p>
                </div>
                <span className="font-display italic text-2xl leading-none text-[#E8A94A]/60">{option.label}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-input)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="What are you shopping for? Try: travel to Las Palmas next week, hero blazer for work, or style these trainers."
              rows={2}
              className="min-h-[72px] flex-1 bg-transparent text-[15px] text-[var(--text)] placeholder-[var(--text-muted)] resize-none outline-none leading-relaxed"
              style={{ scrollbarWidth: 'none' }}
            />

            <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload a photo"
                  className="h-9 rounded-xl px-3 text-sm flex items-center justify-center gap-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Photo
                </button>
                <button
                  onClick={handleMic}
                  title="Speak your request"
                  className={`h-9 rounded-xl px-3 text-sm flex items-center justify-center gap-2 transition-colors ${
                    isListening ? 'bg-[var(--bg-subtle)] text-[var(--text)] animate-pulse' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  Speak
                </button>
              </div>

              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all ${
                  text.trim() ? 'bg-[#E8A94A] text-[#1A0E00] hover:bg-[#f0b85a]' : 'bg-[var(--bg-subtle)] text-[var(--text-faint)] cursor-not-allowed'
                }`}
              >
                See my picks
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="lg:max-w-[190px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
                Tighten The Search
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                Add these now if they matter, or skip and refine on results.
              </p>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text)]">Budget</p>
                  <span className="text-[11px] text-[var(--text-faint)]">Optional</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((budget) => (
                    <button
                      key={budget}
                      onClick={() => setUserProfile({ budget: userProfile.budget === budget ? null : budget })}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                        userProfile.budget === budget
                          ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                          : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                      }`}
                    >
                      {budget}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text)]">Size</p>
                  <span className="text-[11px] text-[var(--text-faint)]">Optional</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() => setUserProfile({ size: userProfile.size === size ? null : size })}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                        userProfile.size === size
                          ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                          : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => submit(p)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 py-1.5 text-xs text-[var(--text-muted)] transition-all hover:border-[#E8A94A]/50 hover:text-[#E8A94A] hover:bg-[#E8A94A]/5"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col overflow-hidden">

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <span className="text-[var(--text)] font-semibold tracking-tight">Wardrobr.ai</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/style" className="text-[var(--text-muted)] text-sm hover:text-[var(--text)] transition-colors py-2 px-1">
            Open stylist →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative flex-1 px-6 pt-14 pb-14 text-center sm:pt-18">

        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        {/* Warm glow orb */}
        <div
          className="animate-breathe absolute pointer-events-none"
          style={{
            top: '28%', left: '50%',
            width: '560px', height: '380px',
            background: 'radial-gradient(ellipse, rgba(253,230,200,0.055) 0%, rgba(220,180,160,0.025) 50%, transparent 75%)',
            borderRadius: '50%',
            filter: 'blur(40px)',
            transformOrigin: 'center center',
          }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-[var(--text-faint)]">
              Free · No signup · UK stores
            </p>
            <h1 className="leading-none">
              <span className="mb-2 block font-sans text-3xl font-light tracking-tight text-[var(--text-muted)] sm:text-4xl">
                Your outfit,
              </span>
              <span
                className="font-display italic font-medium text-[var(--text)]"
                style={{ fontSize: 'clamp(4.5rem, 13vw, 9.5rem)', lineHeight: 0.95 }}
              >
                sorted.
              </span>
            </h1>
            <p className="mt-4 font-display text-xl italic text-[var(--text-muted)] sm:text-2xl">
              One clear start, then sharper picks.
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-[15px]">
              Tell Wardrobr the trip, event, vibe, or item you need. We&apos;ll take you into live results, ask one smart question only when needed, and keep the path to buying clean.
            </p>
          </div>

          <div className="mt-10 w-full">
            <HomepageInput />
            <Script src="https://sovrn.co/zs04ts3" strategy="afterInteractive" />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {TRUST_POINTS.map((point) => (
              <div
                key={point}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs text-[var(--text-muted)] shadow-[0_10px_35px_rgba(26,14,0,0.04)]"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Exact example looks */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-3 text-left sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--text-faint)]">Exact example looks</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">See what “sorted” looks like.</h2>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
              These open exact saved boards, with total price and direct retailer links where available.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
          {EXAMPLE_BOARDS.map((board) => (
            <Link
              key={board.title}
              href={`/board/${board.id}`}
              className="group w-full overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] text-left transition-all hover:border-[#E8A94A]/25 hover:shadow-[0_24px_70px_rgba(26,14,0,0.08)]"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg-subtle)]">
                <Image
                  src={board.board.products[0]?.imageUrl}
                  alt={board.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/85 backdrop-blur-sm">
                  {board.kicker}
                </div>
                <div className="absolute inset-x-4 bottom-4">
                  <h3 className="text-xl font-semibold tracking-tight text-white">{board.title}</h3>
                  <p className="mt-1 text-sm text-white/80">
                    {board.board.products.length}-piece look · {formatPrice(board.board.totalPrice ?? 0)}
                  </p>
                </div>
              </div>

              <div className="p-5">
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                  {board.board.styleNote}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
                  <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-faint)]">
                    Shop this exact look
                  </span>
                  <ArrowRight className="h-4 w-4 text-[var(--text-faint)] transition-colors group-hover:text-[var(--text)]" />
                </div>
              </div>
            </Link>
          ))}
          </div>
        </div>
      </section>

      {/* Affiliate disclosure */}
      <div className="px-6 py-3 border-t border-[var(--border)] text-center">
        <p className="text-[var(--text-faint)] text-xs leading-relaxed max-w-xl mx-auto">
          We earn a commission on purchases made through links on this site, at no extra cost to you.{' '}
          <Link href="/about" className="text-[var(--text-muted)] hover:text-[#E8A94A] underline underline-offset-2 transition-colors">Learn more</Link>
        </p>
      </div>

      <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-[var(--text-faint)] text-xs">© 2026 Wardrobr.ai</span>
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-[var(--text-faint)] text-xs hover:text-[var(--text-muted)] transition-colors">About</Link>
          <Link href="/privacy" className="text-[var(--text-faint)] text-xs hover:text-[var(--text-muted)] transition-colors">Privacy</Link>
          <a href="https://sovrn.co/zs04ts3" className="text-[var(--text-faint)] text-xs hover:text-[var(--text-muted)] transition-colors">Affiliate links</a>
        </div>
      </footer>
    </div>
  )
}
