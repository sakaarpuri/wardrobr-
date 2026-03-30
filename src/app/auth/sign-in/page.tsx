import Link from 'next/link'
import { Suspense } from 'react'
import { AuthCard } from '@/components/auth/AuthCard'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <Link href="/" className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Wardrobr.ai
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-77px)] max-w-5xl items-center px-6 py-12">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-center">
          <Suspense fallback={<div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/90 p-6 text-sm text-[var(--text-muted)]">Loading sign in…</div>}>
            <AuthCard mode="sign-in" />
          </Suspense>

          <section className="rounded-[32px] border border-[rgba(82,126,255,0.14)] bg-[linear-gradient(145deg,rgba(82,126,255,0.10),rgba(255,255,255,0.90))] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">Why join</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">Keep your taste memory switched on</h1>
            <div className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--text-muted)]">
              <p>Wardrobr members get saved boards, remembered sizes, and softer bias toward the brands, budgets, and silhouettes they actually respond to.</p>
              <p>Guests can still use the stylist freely. Members just get continuity.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
