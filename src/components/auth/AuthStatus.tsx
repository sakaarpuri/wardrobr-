'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export function AuthStatus({ compact = false }: { compact?: boolean }) {
  const configured = isSupabaseConfigured()
  const [user, setUser] = useState<User | null | undefined>(configured ? undefined : null)
  const supabase = useMemo(() => {
    if (!configured) return null
    return createSupabaseClient()
  }, [configured])

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  if (!configured || user === undefined) return null

  const label = user?.user_metadata?.full_name?.trim()
    || user?.email?.split('@')[0]
    || 'Account'

  if (user) {
    return (
      <Link
        href="/account"
        className={`rounded-full border border-[var(--border)] bg-[var(--bg-card)]/85 text-[var(--text)] transition-colors hover:border-[#E8A94A]/35 ${compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/auth/sign-in"
        className={`rounded-full border border-[var(--border)] bg-[var(--bg-card)]/85 text-[var(--text-muted)] transition-colors hover:border-[#E8A94A]/35 hover:text-[var(--text)] ${compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'}`}
      >
        Sign in
      </Link>
      <Link
        href="/auth/sign-up"
        className={`rounded-full border border-[#E8A94A]/35 bg-[#E8A94A]/10 text-[#E8A94A] transition-colors hover:bg-[#E8A94A]/14 ${compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'}`}
      >
        Join
      </Link>
    </div>
  )
}
