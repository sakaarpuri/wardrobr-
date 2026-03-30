import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { OutfitBoard } from '@/components/board/OutfitBoard'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { OutfitBoard as OutfitBoardType } from '@/lib/types'

export default async function SavedBoardPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)

  if (!isSupabaseConfigured()) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/sign-in?next=/saved/${resolvedParams.id}`)
  }

  const { data: board } = await supabase
    .from('saved_boards')
    .select('id, title, occasion, board_payload')
    .eq('id', resolvedParams.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!board?.board_payload) {
    notFound()
  }

  const payload = board.board_payload as OutfitBoardType

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <div>
          <Link href="/account" className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
            ← Back to account
          </Link>
          <p className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">{board.title}</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <OutfitBoard board={payload} />
      </main>
    </div>
  )
}
