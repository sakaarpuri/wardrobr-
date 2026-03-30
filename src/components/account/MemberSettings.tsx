'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { MemberPreferences, SavedBoardRecord } from '@/lib/member-memory'
import { updateMemberPreferences } from '@/lib/member-memory-client'

function asCommaList(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function MemberSettings({
  email,
  initialFullName,
  initialPreferences,
  savedBoards,
}: {
  email: string
  initialFullName: string
  initialPreferences: MemberPreferences | null
  savedBoards: SavedBoardRecord[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseClient(), [])
  const [fullName, setFullName] = useState(initialFullName)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState({
    preferred_gender: initialPreferences?.preferred_gender ?? null,
    preferred_size: initialPreferences?.preferred_size ?? '',
    preferred_shoe_size: initialPreferences?.preferred_shoe_size ?? '',
    preferred_budget_label: initialPreferences?.preferred_budget_label ?? '',
    price_tier: initialPreferences?.price_tier ?? null,
    favorite_categories: (initialPreferences?.favorite_categories ?? []).join(', '),
    favorite_colors: (initialPreferences?.favorite_colors ?? []).join(', '),
    favorite_stores: (initialPreferences?.favorite_stores ?? []).join(', '),
    avoided_stores: (initialPreferences?.avoided_stores ?? []).join(', '),
    style_modes: (initialPreferences?.style_modes ?? []).join(', '),
    formality_bias: initialPreferences?.formality_bias ?? '',
    preferred_mission: initialPreferences?.preferred_mission ?? null,
  })

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() || null },
        ...(password ? { password } : {}),
      })

      if (authError) throw authError

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (userId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ id: userId, full_name: fullName.trim() || null })

        if (profileError) throw profileError
      }

      await updateMemberPreferences({
        preferred_gender: prefs.preferred_gender,
        preferred_size: prefs.preferred_size || null,
        preferred_shoe_size: prefs.preferred_shoe_size || null,
        preferred_budget_label: prefs.preferred_budget_label || null,
        price_tier: prefs.price_tier,
        favorite_categories: asCommaList(prefs.favorite_categories),
        favorite_colors: asCommaList(prefs.favorite_colors),
        favorite_stores: asCommaList(prefs.favorite_stores),
        avoided_stores: asCommaList(prefs.avoided_stores),
        style_modes: asCommaList(prefs.style_modes),
        formality_bias: prefs.formality_bias || null,
        preferred_mission: prefs.preferred_mission,
      })

      setPassword('')
      setStatus('Saved')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your account.')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">Member memory</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">Your taste, remembered</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          Wardrobr learns from what you shop, save, swap, and open. It uses that to bias future results gently rather than trapping you in one lane.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
          {['Shop clicks', 'Saved boards', 'Open all tabs', 'Board shares', 'Emails', 'Swaps'].map((item) => (
            <span key={item} className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5">
              {item}
            </span>
          ))}
        </div>
      </section>

      <form onSubmit={saveAccount} className="space-y-6">
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <h3 className="text-lg font-semibold text-[var(--text)]">Profile</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)] focus:border-[#E8A94A]/35"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Email</span>
              <input
                value={email}
                readOnly
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text-muted)] outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">New password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Only fill this if you want to change it"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)] focus:border-[#E8A94A]/35"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <h3 className="text-lg font-semibold text-[var(--text)]">Taste defaults</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField label="Preferred budget label" value={prefs.preferred_budget_label} onChange={(value) => setPrefs((current) => ({ ...current, preferred_budget_label: value }))} placeholder="Under £150" />
            <TextField label="Preferred size" value={prefs.preferred_size} onChange={(value) => setPrefs((current) => ({ ...current, preferred_size: value }))} placeholder="10" />
            <TextField label="Preferred shoe size" value={prefs.preferred_shoe_size} onChange={(value) => setPrefs((current) => ({ ...current, preferred_shoe_size: value }))} placeholder="5" />
            <TextField label="Formality bias" value={prefs.formality_bias} onChange={(value) => setPrefs((current) => ({ ...current, formality_bias: value }))} placeholder="Relaxed, polished, dressy" />
            <SelectField
              label="Shopping for"
              value={prefs.preferred_gender ?? ''}
              options={['', 'women', 'men']}
              onChange={(value) => setPrefs((current) => ({ ...current, preferred_gender: value === 'women' || value === 'men' ? value : null }))}
            />
            <SelectField
              label="Price tier"
              value={prefs.price_tier ?? ''}
              options={['', 'value', 'mid', 'premium', 'luxury']}
              onChange={(value) => setPrefs((current) => ({ ...current, price_tier: value === 'value' || value === 'mid' || value === 'premium' || value === 'luxury' ? value : null }))}
            />
            <SelectField
              label="Preferred request type"
              value={prefs.preferred_mission ?? ''}
              options={['', 'full_look', 'hero_piece', 'match_photo', 'style_existing']}
              onChange={(value) => setPrefs((current) => ({
                ...current,
                preferred_mission:
                  value === 'full_look' || value === 'hero_piece' || value === 'match_photo' || value === 'style_existing'
                    ? value
                    : null,
              }))}
            />
            <div />
            <TextField label="Favourite stores" value={prefs.favorite_stores} onChange={(value) => setPrefs((current) => ({ ...current, favorite_stores: value }))} placeholder="COS, Zara, Arket" />
            <TextField label="Avoid stores" value={prefs.avoided_stores} onChange={(value) => setPrefs((current) => ({ ...current, avoided_stores: value }))} placeholder="Boohoo, Shein" />
            <TextField label="Favourite categories" value={prefs.favorite_categories} onChange={(value) => setPrefs((current) => ({ ...current, favorite_categories: value }))} placeholder="dresses, blazers, sandals" />
            <TextField label="Favourite colours" value={prefs.favorite_colors} onChange={(value) => setPrefs((current) => ({ ...current, favorite_colors: value }))} placeholder="navy, cream, olive" />
            <div className="md:col-span-2">
              <TextField label="Style lean" value={prefs.style_modes} onChange={(value) => setPrefs((current) => ({ ...current, style_modes: value }))} placeholder="minimal, relaxed, tailored" />
            </div>
          </div>
        </section>

        {(status || error) && (
          <div className={`rounded-2xl px-4 py-3 text-sm ${error ? 'border border-rose-500/25 bg-rose-500/10 text-rose-200' : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-100'}`}>
            {error ?? status}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#E8A94A] px-4 py-3 text-sm font-semibold text-[#1A0E00] transition-colors hover:bg-[#f0b85a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save member settings
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:border-[#E8A94A]/35 hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </form>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">Saved boards</p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">Your saved looks</h3>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            {savedBoards.length}
          </span>
        </div>

        {savedBoards.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
            Save boards from the results page and they will show up here.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {savedBoards.map((board) => (
              <Link
                key={board.id}
                href={`/saved/${board.id}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 transition-colors hover:border-[#E8A94A]/35"
              >
                <p className="text-sm font-semibold text-[var(--text)]">{board.title}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{board.occasion || 'Saved board'}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)] focus:border-[#E8A94A]/35"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[#E8A94A]/35"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || 'No preference'}
          </option>
        ))}
      </select>
    </label>
  )
}
