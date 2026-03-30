'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export function AuthCard({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const configured = isSupabaseConfigured()
  const supabase = useMemo(() => {
    if (!configured) return null
    return createSupabaseClient()
  }, [configured])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = searchParams.get('next') || '/account'

  const title = mode === 'sign-up' ? 'Create your member account' : 'Sign in to your member account'
  const body =
    mode === 'sign-up'
      ? 'Members can save boards, keep taste memory, and bring their preferred sizes and pricing back every time.'
      : 'Pick up where you left off, with saved boards and taste memory ready.'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    setLoading(true)
    setError(null)

    try {
      if (mode === 'sign-up') {
        const passwordStrongEnough = password.length >= 6 && /[\d\W_]/.test(password)
        if (!passwordStrongEnough) {
          throw new Error('Use at least 6 characters and include a number or symbol.')
        }

        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || null },
            emailRedirectTo: redirectTo,
          },
        })

        if (signUpError) throw signUpError

        if (data.session) {
          router.push(next)
          router.refresh()
          return
        }

        setConfirmationSent(true)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      router.push(next)
      router.refresh()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (!configured) {
    return (
      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Members need Supabase first</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then run the member-memory migration.
        </p>
      </div>
    )
  }

  if (confirmationSent) {
    return (
      <div className="rounded-[28px] border border-[rgba(82,126,255,0.16)] bg-[linear-gradient(145deg,rgba(82,126,255,0.10),rgba(255,255,255,0.92))] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">Check your inbox</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">Confirmation email sent</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          Open the email we sent to {email} and confirm your account to turn on saved boards and long-term taste memory.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/92 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
        {mode === 'sign-up' ? 'Join Wardrobr' : 'Welcome back'}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{body}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === 'sign-up' && (
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Name</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="How should we address you?"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)] focus:border-[#E8A94A]/35"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)] focus:border-[#E8A94A]/35"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'sign-up' ? 'At least 6 characters, plus a number or symbol' : 'Your password'}
            required
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)] focus:border-[#E8A94A]/35"
          />
        </label>

        {error && (
          <p className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E8A94A] px-4 py-3 text-sm font-semibold text-[#1A0E00] transition-colors hover:bg-[#f0b85a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'sign-up' ? 'Create member account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-sm text-[var(--text-muted)]">
        {mode === 'sign-up' ? 'Already a member?' : 'New here?'}{' '}
        <Link
          href={mode === 'sign-up' ? `/auth/sign-in?next=${encodeURIComponent(next)}` : `/auth/sign-up?next=${encodeURIComponent(next)}`}
          className="text-[#E8A94A] transition-colors hover:text-[#f0b85a]"
        >
          {mode === 'sign-up' ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}
