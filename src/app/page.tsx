'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowRight, Camera, Mic, Send } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { ThemeToggle } from '@/components/ThemeToggle'
import { EXAMPLE_BOARDS } from '@/lib/exampleBoards'
import { APP_VERSION } from '@/lib/version'

const EXAMPLE_PROMPTS = [
  'Trip to India in summer',
  'Wedding guest look under £150',
  'One great blazer for work',
  'Style these trainers for a city break',
]

const TRUST_POINTS = [
  'Voice-first route in',
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

function HomepageInput() {
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { setPendingMessage, clearChat } = useChatStore()

  const submit = (message: string, imageBase64?: string, imageMimeType?: string, imagePreview?: string) => {
    if (!message.trim() && !imageBase64) return
    clearChat()
    setPendingMessage({ text: message.trim(), imageBase64, imageMimeType, imagePreview })
    router.push('/style')
  }

  const handleSend = () => submit(text)

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
    <div className="w-full max-w-4xl rounded-[36px] border border-[var(--border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(240,235,225,0.82))] p-4 shadow-[0_30px_110px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
              Voice First
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Start with the mic. Everything else is optional.
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
              Say the trip, event, vibe, or one item you need. Wardrobr should feel like talking to an AI stylist, not stepping through a setup form.
            </p>
          </div>
          <p className="text-xs text-[var(--text-faint)] sm:max-w-[180px] sm:text-right">
            Filters and starter links live on the next screen.
          </p>
        </div>

        <button
          onClick={handleMic}
          className={`relative w-full overflow-hidden rounded-[32px] border px-5 py-5 text-left transition-all sm:px-6 sm:py-6 ${
            isListening
              ? 'border-[#E8A94A]/60 bg-[linear-gradient(135deg,rgba(232,169,74,0.18),rgba(120,215,255,0.12))] shadow-[0_20px_60px_rgba(74,144,226,0.16)]'
              : 'border-[rgba(72,134,255,0.18)] bg-[linear-gradient(135deg,rgba(82,126,255,0.16),rgba(104,220,255,0.12),rgba(255,255,255,0.22))] hover:border-[rgba(72,134,255,0.34)] hover:shadow-[0_22px_70px_rgba(49,98,255,0.14)]'
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,215,255,0.24),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,211,144,0.20),transparent_36%)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm ${isListening ? 'border-[#E8A94A]/55 bg-[#E8A94A]/18' : 'border-[rgba(82,126,255,0.24)] bg-white/60'}`}>
                <Mic className={`h-6 w-6 ${isListening ? 'animate-pulse text-[#E8A94A]' : 'text-[var(--text)]'}`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
                  Main Route In
                </p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text)]">
                  {isListening ? 'Listening now...' : 'Tap and speak your brief'}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
                  {isListening
                    ? 'Keep talking. We will send your brief as soon as you stop.'
                    : 'Try: “Trip to India in summer,” “Need a wedding guest look under £150,” or “Find me one great blazer for work.”'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
              <span className="rounded-full border border-[rgba(82,126,255,0.22)] bg-white/65 px-3 py-1.5 backdrop-blur-sm">
                {isListening ? 'Stop speaking to send' : 'Tap to speak'}
              </span>
              <ArrowRight className="h-4 w-4 text-[#E8A94A]" />
            </div>
          </div>
        </button>

        <div className="rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                Or type / add a photo
              </p>
              <span className="text-[11px] text-[var(--text-faint)]">Backup route</span>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type the brief here if speaking is awkward..."
              rows={2}
              className="min-h-[72px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
              style={{ scrollbarWidth: 'none' }}
            />

            <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload a photo"
                  className="flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                >
                  <Camera className="h-4 w-4" />
                  Photo
                </button>
                <Link
                  href="/style"
                  className="flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                >
                  Controls
                </Link>
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

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => submit(prompt)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 py-1.5 text-xs text-[var(--text-muted)] transition-all hover:border-[#E8A94A]/50 hover:bg-[#E8A94A]/5 hover:text-[#E8A94A]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-[var(--text-faint)]">
            Budget, size, gender, and starter boards live on the results page so they help without slowing the route in.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col overflow-hidden">
      <nav className="relative z-10 flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <span className="text-[var(--text)] font-semibold tracking-tight">Wardrobr.ai</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/style" className="px-1 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
            Open stylist →
          </Link>
        </div>
      </nav>

      <main className="relative flex-1 px-6 pt-14 pb-14 text-center sm:pt-18">
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

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-[var(--text-faint)]">
              Free · No signup · UK stores
            </p>
            <h1 className="leading-none">
              <span className="mb-2 block text-3xl font-light tracking-tight text-[var(--text-muted)] sm:text-4xl">
                Say the brief,
              </span>
              <span
                className="font-display italic font-medium text-[var(--text)]"
                style={{ fontSize: 'clamp(4.5rem, 13vw, 9.5rem)', lineHeight: 0.95 }}
              >
                get sorted.
              </span>
            </h1>
            <p className="mt-4 text-xl font-display italic text-[var(--text-muted)] sm:text-2xl">
              An AI stylist you talk to, not a flow you fill out.
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-[15px]">
              Start by speaking the trip, event, vibe, or item you need. Wardrobr turns that brief into live shopping results, asks only the fewest necessary follow-ups, and keeps the path to buying clean.
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

      <div className="border-t border-[var(--border)] px-6 py-3 text-center">
        <p className="mx-auto max-w-xl text-xs leading-relaxed text-[var(--text-faint)]">
          We earn a commission on purchases made through links on this site, at no extra cost to you.{` `}
          <Link href="/about" className="underline underline-offset-2 transition-colors hover:text-[#E8A94A] text-[var(--text-muted)]">
            Learn more
          </Link>
        </p>
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4">
        <span className="text-xs text-[var(--text-faint)]">© 2026 Wardrobr.ai · {APP_VERSION}</span>
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]">About</Link>
          <Link href="/privacy" className="text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]">Privacy</Link>
          <a href="https://sovrn.co/zs04ts3" className="text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]">Affiliate links</a>
        </div>
      </footer>
    </div>
  )
}
