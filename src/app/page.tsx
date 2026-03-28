import Link from 'next/link'
import { ArrowRight, MessageSquare, Camera, Shirt } from 'lucide-react'
// MessageSquare, Camera, Shirt used in HOW_IT_WORKS data

const EXAMPLE_BOARDS = [
  {
    title: 'Summer Wedding Guest',
    items: ['Floral Midi Dress · & Other Stories · £89', 'Block Heel Sandals · Dune · £75', 'Mini Clutch · Mango · £29', 'Gold Earrings · ASOS · £12'],
  },
  {
    title: 'New Job, First Week',
    items: ['Tailored Blazer · Reiss · £195', 'Wide Leg Trousers · COS · £79', 'Fitted Tee · Uniqlo · £19', 'Derby Shoes · Clarks · £85'],
  },
  {
    title: 'Holiday Capsule Wardrobe',
    items: ['Linen Shirt Dress · Zara · £39', 'Tailored Shorts · H&M · £24', 'Strappy Sandals · Office · £65', 'Canvas Tote · ASOS · £22'],
  },
]

const HOW_IT_WORKS = [
  {
    icon: MessageSquare,
    title: 'Chat your occasion',
    body: 'Tell me the event, budget, and vibe. "Summer wedding, £200, smart but not stuffy." I\'ll handle the rest.',
  },
  {
    icon: Camera,
    title: 'Show a photo',
    body: 'Upload a screenshot, mood board, or outfit you love. I\'ll read the look and build a shoppable version of it.',
  },
  {
    icon: Shirt,
    title: 'Browse live inspiration',
    body: 'Point your camera at clothes in your wardrobe or a shop window. I\'ll style them into a complete outfit instantly.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <span className="text-white font-semibold tracking-tight">Wardrobr.ai</span>
        <Link
          href="/style"
          className="text-white/50 text-sm hover:text-white transition-colors py-2 px-1"
        >
          Start styling →
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="font-display text-6xl sm:text-8xl font-semibold tracking-tight text-white leading-none mb-6">
          Your AI stylist
          <br />
          <span className="text-white/40">for every occasion.</span>
        </h1>

        <p className="text-white/50 text-lg max-w-md leading-relaxed mb-10">
          Tell me the occasion, your budget, and when it is. I&apos;ll build a complete, shoppable
          outfit from real UK stores in under a minute.
        </p>

        <Link
          href="/style"
          className="flex items-center justify-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors mb-16"
        >
          Start styling →
        </Link>

        {/* Three ways to use — each card is a CTA */}
        <div className="w-full max-w-3xl grid sm:grid-cols-3 gap-4 text-left">
          {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
            <Link
              key={title}
              href="/style"
              className="group bg-zinc-900/60 border border-white/5 hover:border-white/15 hover:bg-zinc-900 rounded-2xl p-5 space-y-3 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Icon className="w-4 h-4 text-white/70" />
              </div>
              <p className="text-white text-sm font-semibold leading-snug">{title}</p>
              <p className="text-white/45 text-xs leading-relaxed">{body}</p>
            </Link>
          ))}
        </div>
      </main>

      {/* Example boards */}
      <section className="px-6 pb-20">
        <p className="text-white/45 text-xs text-center uppercase tracking-widest mb-8">
          Example outfit boards
        </p>
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
          {EXAMPLE_BOARDS.map((board) => (
            <Link
              key={board.title}
              href="/style"
              className="group bg-zinc-900 border border-white/5 hover:border-white/15 rounded-2xl p-5 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-white text-sm font-semibold">{board.title}</h3>
                <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors mt-0.5" />
              </div>
              <ul className="space-y-1.5">
                {board.items.map((item) => (
                  <li key={item} className="text-white/60 text-xs leading-snug">
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-white/35 text-xs">Styled by Wardrobr.ai</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-white/40 text-xs">© 2026 Wardrobr.ai</span>
        <span className="text-white/40 text-xs">UK fashion · Affiliate links</span>
      </footer>
    </div>
  )
}
