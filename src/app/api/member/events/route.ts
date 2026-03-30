import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false }, { status: 200 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, member: false }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const payload = (body ?? {}) as Record<string, unknown>

  const { error } = await supabase
    .from('member_events')
    .insert({
      user_id: user.id,
      event_type: typeof payload.eventType === 'string' ? payload.eventType : 'shop_click',
      board_id: typeof payload.boardId === 'string' ? payload.boardId : null,
      product_id: typeof payload.productId === 'string' ? payload.productId : null,
      store_name: typeof payload.storeName === 'string' ? payload.storeName : null,
      brand: typeof payload.brand === 'string' ? payload.brand : null,
      category: typeof payload.category === 'string' ? payload.category : null,
      price: typeof payload.price === 'number' ? payload.price : null,
      metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {},
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
