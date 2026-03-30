import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MemberSettings } from '@/components/account/MemberSettings'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getMemberMemorySnapshot } from '@/lib/member-memory'

export default async function AccountPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <Link href="/" className="text-xl font-semibold tracking-tight text-[var(--text)]">Wardrobr.ai</Link>
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-3xl px-6 py-14">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]/90 p-6">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Members need Supabase first</h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
              Configure Supabase auth and run the member-memory migration before using the account area.
            </p>
          </div>
        </main>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/sign-in?next=/account')
  }

  const snapshot = await getMemberMemorySnapshot(supabase)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <div>
          <Link href="/" className="text-xl font-semibold tracking-tight text-[var(--text)]">Wardrobr.ai</Link>
          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">Member account</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/style" className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
            Back to stylist
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <MemberSettings
          email={user.email ?? ''}
          initialFullName={(profile?.full_name as string | null) ?? (user.user_metadata?.full_name as string | null) ?? ''}
          initialPreferences={snapshot?.preferences ?? null}
          savedBoards={snapshot?.savedBoards ?? []}
        />
      </main>
    </div>
  )
}
