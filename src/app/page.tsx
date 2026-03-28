'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, MessageSquare, Camera, Shirt, Send, Mic } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'

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

const HOW_IT_WORKS = [
  {
    icon: MessageSquare,
    label: '01',
    title: 'Chat your occasion',
    body: 'Tell me the event, your budget, or a vibe. "Night out under £50" or "wedding guest, nothing too fussy."',
  },
  {
    icon: Camera,
    label: '02',
    title: 'Show a photo',
    body: 'Upload a screenshot or outfit inspo. I\'ll find real, shoppable versions from ASOS, H&M, Zara and more.',
  },
  {
    icon: Shirt,
    label: '03',
    title: 'Live inspiration',
    body: 'Point your camera at something you own or spotted in a shop. I\'ll build a full outfit around it.',
  },
]

const EXAMPLE_BOARDS = [
  {
    title: 'Friday Night Out',
    items: ['Satin Slip Dress · ASOS · £28', 'Strappy Heels · New Look · £22', 'Mini Bag · Primark · £10', 'Gold Hoops · ASOS · £8'],
  },
  {
    title: 'Summer Wedding Guest',
    items: ['Floral Midi Dress · ASOS · £42', 'Block Heel Sandals · New Look · £28', 'Satin Clutch · Primark · £12', 'Pearl Earrings · ASOS · £8'],
  },
  {
    title: 'New Job, First Week',
    items: ['Tailored Blazer · H&M · £49', 'Wide Leg Trousers · Zara · £35', 'Ribbed Tee · ASOS · £14', 'Loafers · New Look · £32'],
  },
]

// ─── Homepage input component ─────────────────────────────────────────────────

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
    <div className="w-full max-w-xl">
      {/* Main input */}
      <div className="flex items-end gap-2 bg-[#130F0C]/90 backdrop-blur border border-white/10 rounded-2xl px-4 py-3 focus-within:border-[#E8A94A]/40 transition-colors">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe the occasion, budget, or a brand you love…"
          rows={1}
          className="flex-1 bg-transparent text-white text-sm placeholder-white/30 resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
          style={{ scrollbarWidth: 'none' }}
        />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload a photo"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            onClick={handleMic}
            title="Speak your request"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isListening ? 'bg-white/15 text-white animate-pulse' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              text.trim() ? 'bg-[#E8A94A] text-[#1A0E00] hover:bg-[#f0b85a]' : 'text-white/20 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Example prompts */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => submit(p)}
            className="text-xs text-white/45 border border-white/10 rounded-full px-3.5 py-1.5 hover:border-[#E8A94A]/50 hover:text-[#E8A94A] hover:bg-[#E8A94A]/5 transition-all"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Feature hints */}
      <p className="text-white/20 text-xs text-center mt-4 leading-relaxed">
        Mention your size, budget, or a brand for inspiration — e.g. "size 10, The Row vibe, under £250"
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const marqueeText = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  const router = useRouter()
  const { clearChat, setPendingMessage } = useChatStore()

  const handleBoardClick = (title: string) => {
    clearChat()
    setPendingMessage({ text: title })
    router.push('/style')
  }

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-hidden">

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/5">
        <span className="text-white font-semibold tracking-tight">Wardrobr.ai</span>
        <Link href="/style" className="text-white/50 text-sm hover:text-white transition-colors py-2 px-1">
          Open stylist →
        </Link>
      </nav>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">

        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
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
          <p className="text-white/30 text-xs uppercase tracking-[0.35em] font-medium mb-5">
            Free · No signup · UK stores
          </p>
          <h1 className="leading-none mb-3">
            <span className="block text-white/45 font-sans font-light text-3xl sm:text-4xl tracking-tight mb-1">
              Your outfit,
            </span>
            <span
              className="font-display italic font-medium text-white"
              style={{ fontSize: 'clamp(5rem, 14vw, 10rem)', lineHeight: 1 }}
            >
              sorted.
            </span>
          </h1>
          <p className="font-display italic text-white/35 text-xl sm:text-2xl mt-3">
            any occasion. any budget.
          </p>
        </div>

        <p className="relative z-10 text-white/45 text-sm max-w-xs leading-relaxed mb-8">
          Tell me what you need — I&apos;ll pull a complete look from ASOS,
          H&amp;M, Zara, New Look and more. Shoppable immediately.
        </p>

        {/* Live input — the entry point */}
        <div className="relative z-10 mb-14">
          <HomepageInput />
        </div>

        {/* Marquee strip */}
        <div className="relative z-10 w-screen -mx-6 border-y border-white/5 py-3 overflow-hidden mb-14">
          <div className="animate-marquee flex gap-8 whitespace-nowrap w-max">
            {marqueeText.map((item, i) => (
              <span key={i} className="text-white/20 text-xs uppercase tracking-widest font-medium flex-shrink-0">
                {item}
                <span className="mx-4 text-white/10">·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Three mode cards */}
        <div className="relative z-10 w-full max-w-3xl grid sm:grid-cols-3 gap-px bg-[#E8A94A]/8 rounded-2xl overflow-hidden border border-[#E8A94A]/10">
          {HOW_IT_WORKS.map(({ icon: Icon, label, title, body }) => (
            <Link
              key={title}
              href="/style"
              className="group bg-[#100D0A] hover:bg-[#18120E] p-6 space-y-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-display italic text-[#E8A94A]/50 text-3xl leading-none group-hover:text-[#E8A94A]/80 transition-colors">{label}</span>
                <div className="w-8 h-8 rounded-lg bg-[#E8A94A]/8 border border-[#E8A94A]/15 flex items-center justify-center group-hover:bg-[#E8A94A]/15 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-[#E8A94A]/70" />
                </div>
              </div>
              <div>
                <p className="text-white text-sm font-semibold mb-1.5">{title}</p>
                <p className="text-white/35 text-xs leading-relaxed">{body}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Example boards */}
      <div className="flex items-center gap-4 px-6 py-8 max-w-4xl mx-auto w-full">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-white/25 text-xs uppercase tracking-widest">Example boards</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
          {EXAMPLE_BOARDS.map((board) => (
            <button
              key={board.title}
              onClick={() => handleBoardClick(board.title)}
              className="group bg-[#110D0A]/80 border border-white/5 hover:border-[#E8A94A]/25 rounded-2xl p-5 transition-all text-left w-full"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-white text-sm font-semibold">{board.title}</h3>
                <ArrowRight className="w-3.5 h-3.5 text-white/25 group-hover:text-white/50 transition-colors mt-0.5 flex-shrink-0" />
              </div>
              <ul className="space-y-2">
                {board.items.map((item) => (
                  <li key={item} className="text-white/45 text-xs leading-snug">{item}</li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-white/25 text-xs font-display italic">Try this board →</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <footer className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-white/30 text-xs">© 2026 Wardrobr.ai</span>
        <span className="text-white/30 text-xs">UK fashion · Affiliate links</span>
      </footer>
    </div>
  )
}
