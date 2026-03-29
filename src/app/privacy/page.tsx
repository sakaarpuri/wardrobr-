import Link from 'next/link'
import type { Metadata } from 'next'
import { APP_VERSION } from '@/lib/version'

export const metadata: Metadata = {
  title: 'Privacy Policy — Wardrobr.ai',
  description: 'How Wardrobr.ai collects, uses, and protects your information.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <Link href="/" className="text-[var(--text)] font-semibold tracking-tight">Wardrobr.ai</Link>
        <Link href="/" className="text-[var(--text-muted)] text-sm hover:text-[var(--text)] transition-colors">← Home</Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="font-display italic text-4xl text-[var(--text)] mb-2">Privacy Policy</h1>
        <p className="text-[var(--text-muted)] text-sm mb-12">Last updated: 29 March 2026</p>

        <div className="space-y-10 text-[var(--text-muted)] text-sm leading-relaxed">

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">1. Who we are</h2>
            <p>
              Wardrobr.ai is an AI-powered personal styling service operated from the United Kingdom.
              We help users discover shoppable outfits from UK and international retailers. You can
              contact us at <a href="mailto:hello@wardrobr.ai" className="text-[#E8A94A] hover:underline">hello@wardrobr.ai</a>.
            </p>
          </section>

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">2. What information we collect</h2>
            <p className="mb-3">We collect only what is necessary to provide the styling service:</p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-muted)]">
              <li><strong className="text-[var(--text)]">Style requests</strong> — the text, images, or voice input you submit to get outfit recommendations.</li>
              <li><strong className="text-[var(--text)]">Usage data</strong> — standard server logs (page views, browser type, IP address) collected automatically.</li>
              <li><strong className="text-[var(--text)]">Preferences</strong> — size, gender, and budget preferences you optionally provide within a session.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-[var(--text)]">not</strong> require account registration. We do not collect your name or email address unless you contact us directly.
            </p>
          </section>

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">3. How we use your information</h2>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-muted)]">
              <li>To generate personalised outfit recommendations via Google Gemini AI.</li>
              <li>To search for matching products via our affiliate partner network (Sovrn Commerce / Skimlinks).</li>
              <li>To improve the accuracy and quality of our styling suggestions.</li>
              <li>To monitor site performance and fix errors.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">4. Affiliate links &amp; third parties</h2>
            <p className="mb-3">
              Wardrobr.ai earns a commission when you click on product links and make a purchase.
              This is at no extra cost to you. Our affiliate partnerships include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-muted)]">
              <li><strong className="text-[var(--text)]">Sovrn Commerce (Viglink)</strong> — affiliate link management. <a href="https://sovrn.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-[#E8A94A] hover:underline">Their privacy policy</a>.</li>
              <li><strong className="text-[var(--text)]">Skimlinks</strong> — affiliate link management. <a href="https://skimlinks.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-[#E8A94A] hover:underline">Their privacy policy</a>.</li>
              <li><strong className="text-[var(--text)]">Google Gemini</strong> — AI processing of your style requests. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#E8A94A] hover:underline">Google&apos;s privacy policy</a>.</li>
            </ul>
            <p className="mt-3">
              These third parties may set cookies or collect data in accordance with their own privacy policies.
              We do not sell your personal data to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">5. Cookies</h2>
            <p>
              We use only essential cookies required for the site to function. Our affiliate partners
              (Sovrn, Skimlinks) may set cookies to track clicks for commission attribution. These are
              standard industry practice and do not identify you personally.
            </p>
          </section>

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">6. Data retention</h2>
            <p>
              Style requests and images you submit are processed in real-time and are not stored on our
              servers beyond the duration of your session. Server logs are retained for up to 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">7. Your rights (UK GDPR)</h2>
            <p className="mb-3">As a UK resident, you have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-muted)]">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction or deletion of your data.</li>
              <li>Object to processing of your data.</li>
              <li>Lodge a complaint with the ICO at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-[#E8A94A] hover:underline">ico.org.uk</a>.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at <a href="mailto:hello@wardrobr.ai" className="text-[#E8A94A] hover:underline">hello@wardrobr.ai</a>.
            </p>
          </section>

          <section>
            <h2 className="text-[var(--text)] text-base font-semibold mb-3">8. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be noted at the top of
              this page with a revised date. Continued use of Wardrobr.ai after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

        </div>
      </main>

      <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between mt-12">
        <span className="text-[var(--text-faint)] text-xs">© 2026 Wardrobr.ai · {APP_VERSION}</span>
        <div className="flex gap-4">
          <Link href="/about" className="text-[var(--text-faint)] text-xs hover:text-[var(--text-muted)] transition-colors">About</Link>
          <Link href="/privacy" className="text-[var(--text-faint)] text-xs hover:text-[var(--text-muted)] transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
