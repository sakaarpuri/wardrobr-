'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowRight, Camera, Send, Mic } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BUDGET_OPTIONS, MISSION_OPTIONS, SIZE_OPTIONS } from '@/lib/shopper'
import { EXAMPLE_BOARDS } from '@/lib/exampleBoards'

const MARQUEE_ITEMS = [
  'Summer Wedding', 'Job Interview', 'First Date', 'Weekend Brunch',
  'Gallery Opening', 'Garden Party', 'Business Casual', 'Holiday Capsule',
  'Night Out', 'Country Weekend', 'Cocktail Party', 'Festival Season',
  'City Break', 'Ski Holiday', 'Dinner Party', 'Graduation Day',
]

const EXAMPLE_PROMPTS = [
  'Night out, under £60',
  'Summer wedding, £150 max',
  'New job, smart casual',
  'Holiday looks, ASOS budget',
]

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
    <div className="w-full max-w-3xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {MISSION_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setUserProfile({ mission: userProfile.mission === option.value ? null : option.value })}
            className={`rounded-2xl border p-4 text-left transition-all ${
              userProfile.mission === option.value
                ? 'border-[#E8A94A]/55 bg-[#E8A94A]/10 shadow-[0_0_0_1px_rgba(232,169,74,0.08)]'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[#E8A94A]/30 hover:bg-[var(--bg-card)]'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[var(--text)] text-sm font-semibold">{option.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{option.body}</p>
              </div>
              <span className="font-display italic text-3xl leading-none text-[#E8A94A]/60">{option.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Main input */}
      <div className="flex items-end gap-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-2xl px-4 py-3.5 focus-within:border-[#E8A94A]/60 transition-colors shadow-lg shadow-black/40">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="What are you shopping for? Try: wedding guest look, hero blazer for work, or style these trainers."
          rows={1}
          className="flex-1 bg-transparent text-[var(--text)] text-sm placeholder-[var(--text-muted)] resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
          style={{ scrollbarWidth: 'none' }}
        />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload a photo"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            onClick={handleMic}
            title="Speak your request"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isListening ? 'bg-[var(--border)] text-[var(--text)] animate-pulse' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)]'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              text.trim() ? 'bg-[#E8A94A] text-[#1A0E00] hover:bg-[#f0b85a]' : 'text-[var(--text-faint)] cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[var(--text)] text-xs font-semibold uppercase tracking-[0.25em]">Budget</p>
            <span className="text-[var(--text-faint)] text-[11px]">Optional</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map((budget) => (
              <button
                key={budget}
                onClick={() => setUserProfile({ budget: userProfile.budget === budget ? null : budget })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  userProfile.budget === budget
                    ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                }`}
              >
                {budget}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[var(--text)] text-xs font-semibold uppercase tracking-[0.25em]">Size</p>
            <span className="text-[var(--text-faint)] text-[11px]">Optional</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => setUserProfile({ size: userProfile.size === size ? null : size })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  userProfile.size === size
                    ? 'border-[#E8A94A]/60 bg-[#E8A94A]/10 text-[#E8A94A]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Example prompts */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => submit(p)}
            className="text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-full px-3.5 py-1.5 hover:border-[#E8A94A]/50 hover:text-[#E8A94A] hover:bg-[#E8A94A]/5 transition-all"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Feature hints */}
      <p className="text-[var(--text-faint)] text-xs text-center mt-4 leading-relaxed">
        We&apos;ll carry your mission, budget, and size into the results page, then tighten the picks from there.
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const marqueeText = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

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
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">

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

        {/* Headline */}
        <div className="relative z-10 mb-6">
          <p className="text-[var(--text-faint)] text-xs uppercase tracking-[0.35em] font-medium mb-5">
            Free · No signup · UK stores
          </p>
          <h1 className="leading-none mb-3">
            <span className="block text-[var(--text-muted)] font-sans font-light text-3xl sm:text-4xl tracking-tight mb-1">
              Your outfit,
            </span>
            <span
              className="font-display italic font-medium text-[var(--text)]"
              style={{ fontSize: 'clamp(5rem, 14vw, 10rem)', lineHeight: 1 }}
            >
              sorted.
            </span>
          </h1>
          <p className="font-display italic text-[var(--text-muted)] text-xl sm:text-2xl mt-3">
            start fast. refine with confidence.
          </p>
        </div>

        <p className="relative z-10 text-[var(--text-muted)] text-sm max-w-md leading-relaxed mb-8">
          Start with the shopping mission, add a budget or size if you want tighter picks, and we&apos;ll take you straight into live product results from UK stores.
        </p>

        {/* Live input — the entry point */}
        <div className="relative z-10 mb-14">
          <HomepageInput />
          {/* Sovrn Commerce verification snippet */}
          <Script src="https://sovrn.co/zs04ts3" strategy="afterInteractive" />
        </div>

        {/* Marquee strip */}
        <div className="relative z-10 w-screen -mx-6 border-y border-[var(--border)] py-3 overflow-hidden mb-14">
          <div className="animate-marquee flex gap-8 whitespace-nowrap w-max">
            {marqueeText.map((item, i) => (
              <span key={i} className="text-[var(--text-faint)] text-xs uppercase tracking-widest font-medium flex-shrink-0">
                {item}
                <span className="mx-4 text-[var(--text-faint)]">·</span>
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-[#E8A94A]/10 bg-[var(--bg-subtle)] p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-faint)]">Homepage</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">Capture the brief quickly</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">Mission first, then optional budget and size. No long form up front.</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-faint)]">Results</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">Show the search working</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">Status updates, live product discovery, then a tighter board with budget context.</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-faint)]">Shop</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">Go to the retailer</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">When we can resolve a merchant PDP, the shop action now goes there instead of a Google wrapper.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Exact example looks */}
      <div className="flex items-center gap-4 px-6 py-8 max-w-4xl mx-auto w-full">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-[var(--text-faint)] text-xs uppercase tracking-widest">Exact example looks</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
          {EXAMPLE_BOARDS.map((board) => (
            <Link
              key={board.title}
              href={`/board/${board.id}`}
              className="group bg-[var(--bg-card)] border border-[var(--border)] hover:border-[#E8A94A]/25 rounded-2xl p-5 transition-all text-left w-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[var(--text-faint)] text-[10px] uppercase tracking-[0.25em]">{board.kicker}</p>
                  <h3 className="mt-1 text-[var(--text)] text-sm font-semibold">{board.title}</h3>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover:text-[var(--text-muted)] transition-colors mt-0.5 flex-shrink-0" />
              </div>
              <ul className="space-y-2">
                {board.board.products.map((product) => (
                  <li key={product.id} className="text-[var(--text-muted)] text-xs leading-snug">
                    {product.name} · {product.brand} · £{product.price}
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <span className="text-[var(--text-faint)] text-xs font-display italic">Shop this exact look →</span>
              </div>
            </Link>
          ))}
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
