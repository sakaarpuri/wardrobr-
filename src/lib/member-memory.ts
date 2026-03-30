import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { UserProfile } from './shopper'

export type PriceTier = 'value' | 'mid' | 'premium' | 'luxury'
export type MemoryEventType =
  | 'shop_click'
  | 'open_all_tabs'
  | 'save_board'
  | 'board_email'
  | 'board_share'
  | 'board_generated'
  | 'product_swapped'
  | 'anchor_selected'
  | 'handoff_opened'
  | 'board_resumed'
  | 'followup_prompt_accepted'

export interface MemberPreferences {
  user_id: string
  preferred_gender: 'women' | 'men' | null
  preferred_size: string | null
  preferred_shoe_size: string | null
  preferred_budget_label: string | null
  price_tier: PriceTier | null
  favorite_categories: string[]
  favorite_colors: string[]
  favorite_stores: string[]
  avoided_stores: string[]
  style_modes: string[]
  formality_bias: string | null
  preferred_mission: UserProfile['mission']
  created_at?: string
  updated_at?: string
}

export interface MemberEvent {
  id?: string
  user_id?: string
  event_type: MemoryEventType
  board_id?: string | null
  product_id?: string | null
  store_name?: string | null
  brand?: string | null
  category?: string | null
  price?: number | null
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface SavedBoardRecord {
  id: string
  user_id: string
  source_board_id?: string | null
  title: string
  occasion?: string | null
  board_payload: Record<string, unknown>
  created_at: string
}

export interface MemberMemorySnapshot {
  user: User | null
  preferences: MemberPreferences | null
  recentEvents: MemberEvent[]
  savedBoards: SavedBoardRecord[]
}

const LUXURY_STORES = ['reiss', 'selfridges', 'harvey nichols', 'net-a-porter', 'farfetch']
const PREMIUM_STORES = ['cos', '& other stories', 'arket', 'massimo dutti', 'whistles']

export function getEmptyMemberPreferences(userId: string): MemberPreferences {
  return {
    user_id: userId,
    preferred_gender: null,
    preferred_size: null,
    preferred_shoe_size: null,
    preferred_budget_label: null,
    price_tier: null,
    favorite_categories: [],
    favorite_colors: [],
    favorite_stores: [],
    avoided_stores: [],
    style_modes: [],
    formality_bias: null,
    preferred_mission: null,
  }
}

export function normaliseList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
}

export function normaliseMemberPreferences(row: Partial<MemberPreferences> | null | undefined): MemberPreferences | null {
  if (!row?.user_id) return null

  return {
    user_id: row.user_id,
    preferred_gender: row.preferred_gender ?? null,
    preferred_size: row.preferred_size ?? null,
    preferred_shoe_size: row.preferred_shoe_size ?? null,
    preferred_budget_label: row.preferred_budget_label ?? null,
    price_tier: row.price_tier ?? null,
    favorite_categories: normaliseList(row.favorite_categories),
    favorite_colors: normaliseList(row.favorite_colors),
    favorite_stores: normaliseList(row.favorite_stores),
    avoided_stores: normaliseList(row.avoided_stores),
    style_modes: normaliseList(row.style_modes),
    formality_bias: row.formality_bias ?? null,
    preferred_mission: row.preferred_mission ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function getPreferredPriceTier(events: MemberEvent[], explicitTier?: PriceTier | null): PriceTier | null {
  if (explicitTier) return explicitTier
  if (events.length === 0) return null

  const explicitStoreTier = events
    .map((event) => event.store_name?.toLowerCase() ?? '')
    .filter(Boolean)
    .reduce<PriceTier | null>((tier, store) => {
      if (LUXURY_STORES.includes(store)) return 'luxury'
      if (PREMIUM_STORES.includes(store)) return tier === 'luxury' ? tier : 'premium'
      return tier
    }, null)

  if (explicitStoreTier) return explicitStoreTier

  const pricedEvents = events.filter((event) => typeof event.price === 'number' && Number.isFinite(event.price))
  if (pricedEvents.length === 0) return null

  const averagePrice = pricedEvents.reduce((sum, event) => sum + Number(event.price ?? 0), 0) / pricedEvents.length
  if (averagePrice >= 180) return 'luxury'
  if (averagePrice >= 90) return 'premium'
  if (averagePrice >= 40) return 'mid'
  return 'value'
}

function topValues(values: Array<string | null | undefined>, limit = 3) {
  const counts = new Map<string, number>()
  values.forEach((value) => {
    const key = value?.trim()
    if (!key) return
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value)
}

export function applyMemberPreferencesToProfile(
  profile: UserProfile,
  preferences: MemberPreferences | null
): Partial<UserProfile> {
  if (!preferences) return {}

  const next: Partial<UserProfile> = {}

  if (!profile.gender && preferences.preferred_gender) next.gender = preferences.preferred_gender
  if (!profile.size && preferences.preferred_size) next.size = preferences.preferred_size
  if (!profile.shoeSize && preferences.preferred_shoe_size) next.shoeSize = preferences.preferred_shoe_size
  if (!profile.budget && preferences.preferred_budget_label) next.budget = preferences.preferred_budget_label
  if (!profile.mission && preferences.preferred_mission) next.mission = preferences.preferred_mission

  return next
}

export function buildMemberMemoryContext(snapshot: MemberMemorySnapshot | null) {
  if (!snapshot?.user) return ''

  const preferences = snapshot.preferences
  const recentEvents = snapshot.recentEvents
  const topStores = topValues([
    ...normaliseList(preferences?.favorite_stores),
    ...recentEvents.map((event) => event.store_name),
  ])
  const topCategories = topValues([
    ...normaliseList(preferences?.favorite_categories),
    ...recentEvents.map((event) => event.category),
  ])
  const topStyles = topValues(normaliseList(preferences?.style_modes))
  const priceTier = getPreferredPriceTier(recentEvents, preferences?.price_tier ?? null)
  const savedBoardsCount = snapshot.savedBoards.length

  const parts: string[] = ['[Member memory: returning signed-in shopper']

  if (priceTier) parts.push(`usually prefers ${priceTier} pricing`)
  if (preferences?.preferred_gender) parts.push(`typically shops ${preferences.preferred_gender}`)
  if (preferences?.preferred_size) parts.push(`often wears size ${preferences.preferred_size}`)
  if (preferences?.preferred_shoe_size) parts.push(`often needs shoe size ${preferences.preferred_shoe_size}`)
  if (preferences?.preferred_budget_label) parts.push(`often works within ${preferences.preferred_budget_label}`)
  if (topStores.length > 0) parts.push(`tends to click ${topStores.join(', ')}`)
  if (topCategories.length > 0) parts.push(`often shops ${topCategories.join(', ')}`)
  if (topStyles.length > 0) parts.push(`style lean: ${topStyles.join(', ')}`)
  if (preferences?.formality_bias) parts.push(`formality bias: ${preferences.formality_bias}`)
  if (preferences?.preferred_mission) parts.push(`usually wants ${preferences.preferred_mission.replace('_', ' ')}`)
  if (savedBoardsCount > 0) parts.push(`has saved ${savedBoardsCount} boards`)

  return `${parts.join(', ')}.]`
}

export async function getMemberMemorySnapshot(supabase: SupabaseClient): Promise<MemberMemorySnapshot | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const prefsResponse = await supabase
    .from('member_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const eventsResponse = await supabase
    .from('member_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40)

  const savedBoardsResponse = await supabase
    .from('saved_boards')
    .select('id, user_id, source_board_id, title, occasion, board_payload, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12)

  return {
    user,
    preferences: normaliseMemberPreferences(prefsResponse?.data),
    recentEvents: (eventsResponse?.data as MemberEvent[] | null) ?? [],
    savedBoards: (savedBoardsResponse?.data as SavedBoardRecord[] | null) ?? [],
  }
}

export function buildPreferencePatchFromPayload(payload: Record<string, unknown>) {
  return {
    preferred_gender:
      payload.preferred_gender === 'women' || payload.preferred_gender === 'men'
        ? payload.preferred_gender
        : null,
    preferred_size: typeof payload.preferred_size === 'string' ? payload.preferred_size.trim() || null : null,
    preferred_shoe_size: typeof payload.preferred_shoe_size === 'string' ? payload.preferred_shoe_size.trim() || null : null,
    preferred_budget_label: typeof payload.preferred_budget_label === 'string' ? payload.preferred_budget_label.trim() || null : null,
    price_tier:
      payload.price_tier === 'value' ||
      payload.price_tier === 'mid' ||
      payload.price_tier === 'premium' ||
      payload.price_tier === 'luxury'
        ? payload.price_tier
        : null,
    favorite_categories: normaliseList(payload.favorite_categories),
    favorite_colors: normaliseList(payload.favorite_colors),
    favorite_stores: normaliseList(payload.favorite_stores),
    avoided_stores: normaliseList(payload.avoided_stores),
    style_modes: normaliseList(payload.style_modes),
    formality_bias: typeof payload.formality_bias === 'string' ? payload.formality_bias.trim() || null : null,
    preferred_mission:
      payload.preferred_mission === 'full_look' ||
      payload.preferred_mission === 'hero_piece' ||
      payload.preferred_mission === 'match_photo' ||
      payload.preferred_mission === 'style_existing'
        ? payload.preferred_mission
        : null,
  }
}
