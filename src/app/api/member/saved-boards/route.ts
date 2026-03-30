import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to save boards.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const board = (body as { board?: { id?: string; title?: string; occasion?: string } & Record<string, unknown> } | null)?.board

  if (!board?.title) {
    return NextResponse.json({ error: 'Board payload missing.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_boards')
    .insert({
      user_id: user.id,
      source_board_id: typeof board.id === 'string' ? board.id : null,
      title: board.title,
      occasion: typeof board.occasion === 'string' ? board.occasion : null,
      board_payload: board,
    })
    .select('id, title')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await supabase.from('member_events').insert({
    user_id: user.id,
    event_type: 'save_board',
    board_id: typeof board.id === 'string' ? board.id : null,
    metadata: {
      title: board.title,
      occasion: typeof board.occasion === 'string' ? board.occasion : null,
    },
  })

  return NextResponse.json({ savedBoard: data })
}
