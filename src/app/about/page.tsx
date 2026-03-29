import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About — Wardrobr.ai',
  description: 'Wardrobr.ai is a free AI personal stylist that finds real, shoppable outfits from UK stores.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0C0A09] text-white">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <Link href="/" className="text-white font-semibold tracking-tight">Wardrobr.ai</Link>
        <Link href="/" className="text-white/50 text-sm hover:text-white transition-colors">← Home</Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-white/30 text-xs uppercase tracking-[0.3em] mb-4">About</p>
        <h1 className="font-display italic text-5xl text-white leading-none mb-8">
          Style sorted,<br />instantly.
        </h1>

        <div className="space-y-6 text-white/65 text-sm leading-relaxed">
          <p>
            Wardrobr.ai is a free AI personal stylist built for real life and real budgets.
            Tell it where you&apos;re going, what you want to spend, or show it something you love —
            and it pulls together a complete, shoppable outfit from UK retailers like ASOS, H&amp;M,
            Zara, New Look, and Primark in seconds.
          </p>
          <p>
            No subscription. No signup. No algorithm trying to sell you things you don&apos;t need.
            Just honest, taste-led recommendations from stores you already know, at prices that
            actually make sense.
          </p>
          <p>
            The service is powered by Google Gemini AI and covers women&apos;s and men&apos;s fashion
            across every occasion — from a quick weeknight dinner to a summer wedding.
          </p>

          <div className="border-t border-white/8 pt-8 mt-8">
            <h2 className="text-[#EDE0CE] text-base font-semibold mb-4">Affiliate disclosure</h2>
            <p>
              Wardrobr.ai earns a small commission when you click a product link and make a purchase.
              This is how we keep the service free. It costs you nothing extra — the price you see
              is the price you pay. We work with{' '}
              <a href="https://sovrn.com" target="_blank" rel="noopener noreferrer" className="text-[#E8A94A] hover:underline">Sovrn Commerce</a>{' '}
              and{' '}
              <a href="https://skimlinks.com" target="_blank" rel="noopener noreferrer" className="text-[#E8A94A] hover:underline">Skimlinks</a>{' '}
              to manage affiliate partnerships. Our recommendations are never influenced by commission rates.
            </p>
          </div>

          <div className="border-t border-white/8 pt-8">
            <h2 className="text-[#EDE0CE] text-base font-semibold mb-4">Get in touch</h2>
            <p>
              Questions, feedback, or press enquiries — we&apos;d love to hear from you.
            </p>
            <a
              href="mailto:hello@wardrobr.ai"
              className="inline-block mt-3 text-[#E8A94A] hover:text-[#f0b85a] text-sm transition-colors"
            >
              hello@wardrobr.ai →
            </a>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-white/5 flex items-center justify-between mt-12">
        <span className="text-white/30 text-xs">© 2026 Wardrobr.ai</span>
        <div className="flex gap-4">
          <Link href="/about" className="text-white/30 text-xs hover:text-white/50 transition-colors">About</Link>
          <Link href="/privacy" className="text-white/30 text-xs hover:text-white/50 transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
