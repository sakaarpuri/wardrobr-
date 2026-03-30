import { NextResponse } from 'next/server'
import { buildPreferencePatchFromPayload, getEmptyMemberPreferences, normaliseMemberPreferences } from '@/lib/member-memory'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, preferences: null })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ configured: true, member: false, preferences: null }, { status: 200 })
  }

  const { data } = await supabase
    .from('member_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    configured: true,
    member: true,
    preferences: normaliseMemberPreferences(data) ?? getEmptyMemberPreferences(user.id),
  })
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to save member preferences.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const patch = buildPreferencePatchFromPayload((body ?? {}) as Record<string, unknown>)

  const { data, error } = await supabase
    .from('member_preferences')
    .upsert({
      user_id: user.id,
      ...patch,
    }, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ preferences: normaliseMemberPreferences(data) })
}
