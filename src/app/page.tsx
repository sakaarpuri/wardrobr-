import Link from 'next/link'
import { ArrowRight, Upload, MessageSquare } from 'lucide-react'

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
          Tell me the occasion, your budget, and when it is. I'll build a complete, shoppable
          outfit from real UK stores in under a minute.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/style"
            className="flex items-center justify-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload a look
          </Link>
          <Link
            href="/style"
            className="flex items-center justify-center gap-2 border border-white/15 text-white font-medium px-6 py-3 rounded-xl hover:border-white/30 hover:bg-white/5 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Describe your style
          </Link>
        </div>
      </main>

      {/* Example boards */}
      <section className="px-6 pb-20">
        <p className="text-white/30 text-xs text-center uppercase tracking-widest mb-8">
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
                  <li key={item} className="text-white/40 text-xs leading-snug">
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-white/20 text-xs">Styled by Wardrobr.ai</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-white/20 text-xs">© 2026 Wardrobr.ai</span>
        <span className="text-white/20 text-xs">UK fashion · Affiliate links</span>
      </footer>
    </div>
  )
}
