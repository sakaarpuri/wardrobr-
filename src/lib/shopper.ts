export type ShopperMission = 'full_look' | 'hero_piece' | 'match_photo' | 'style_existing'
export type BudgetScope = 'total' | 'per_item'
export type OccasionStrictness = 'relaxed' | 'balanced' | 'strict'
export type SwapActionKey =
  | 'cheaper'
  | 'dressier'
  | 'more_casual'
  | 'different_store'
  | 'flats_instead'
  | 'different_colour'
  | 'same_vibe'

export interface UserProfile {
  gender: 'women' | 'men' | null
  size: string | null
  shoeSize: string | null
  budget: string | null
  budgetScope: BudgetScope
  mission: ShopperMission | null
  fitNotes: string | null
  occasionStrictness: OccasionStrictness | null
}

export const BUDGET_OPTIONS = ['Under £50', '£50–150', '£150–300', '£300+'] as const
export const SIZE_OPTIONS = ['6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL'] as const
export const SHOPPING_FOR_OPTIONS = ['Women', 'Men'] as const

export const MISSION_OPTIONS: Array<{
  value: ShopperMission
  label: string
  title: string
  body: string
}> = [
  {
    value: 'full_look',
    label: '01',
    title: 'Build a full look',
    body: 'The quickest route to a head-to-toe outfit for an event, trip, or work moment.',
  },
  {
    value: 'hero_piece',
    label: '02',
    title: 'Find one hero piece',
    body: 'Start with the dress, blazer, jacket, or shoes you actually want to buy first.',
  },
  {
    value: 'match_photo',
    label: '03',
    title: 'Match an inspo photo',
    body: 'Upload a screenshot and get live product picks that capture the same feel.',
  },
  {
    value: 'style_existing',
    label: '04',
    title: 'Style something you own',
    body: 'Use one item already in your wardrobe as the anchor, then build around it.',
  },
]

export function getEmptyUserProfile(): UserProfile {
  return {
    gender: null,
    size: null,
    shoeSize: null,
    budget: null,
    budgetScope: 'total',
    mission: null,
    fitNotes: null,
    occasionStrictness: null,
  }
}

export function normaliseUserProfile(profile?: Partial<UserProfile> | null): UserProfile {
  return {
    ...getEmptyUserProfile(),
    ...(profile ?? {}),
  }
}

export function buildProfileContext(profile: UserProfile): string {
  const parts: string[] = []

  if (profile.mission) parts.push(`shopping mission: ${getMissionPrompt(profile.mission)}`)
  if (profile.gender) parts.push(`shopping for ${profile.gender}'s clothing`)
  if (profile.size) parts.push(`preferred UK size ${profile.size}`)
  if (profile.shoeSize) parts.push(`preferred UK shoe size ${profile.shoeSize}`)
  if (profile.budget) parts.push(`${profile.budgetScope === 'per_item' ? 'per-item budget' : 'total budget'} ${profile.budget}`)
  if (profile.fitNotes) parts.push(`fit notes: ${profile.fitNotes}`)
  if (profile.occasionStrictness) parts.push(`occasion strictness: ${profile.occasionStrictness}`)

  if (parts.length === 0) return ''
  return `[Shopper brief: ${parts.join(', ')}]`
}

export function getMissionPrompt(mission: ShopperMission): string {
  switch (mission) {
    case 'hero_piece':
      return 'find one hero piece first'
    case 'match_photo':
      return 'match an inspiration photo with shoppable products'
    case 'style_existing':
      return 'style something the shopper already owns'
    case 'full_look':
    default:
      return 'build a complete look'
  }
}

export function getMissionTitle(mission: ShopperMission | null): string | null {
  if (!mission) return null
  return MISSION_OPTIONS.find((option) => option.value === mission)?.title ?? null
}

export function getBudgetCap(label: string | null): number | null {
  if (!label) return null
  if (label === 'Under £50') return 50
  if (label === '£50–150') return 150
  if (label === '£150–300') return 300
  if (label === '£300+') return null
  return null
}

export function getSearchPriceCap(profile: UserProfile): number | null {
  const totalCap = getBudgetCap(profile.budget)
  if (!totalCap) return null

  if (profile.budgetScope === 'per_item' || profile.mission === 'hero_piece') return totalCap

  const divisor = profile.mission === 'style_existing' ? 3 : 4
  return Math.max(15, Math.ceil(totalCap / divisor))
}

export function getBudgetStatus(totalPrice: number, budgetLabel: string | null): 'under' | 'over' | 'unknown' {
  const cap = getBudgetCap(budgetLabel)
  if (!cap) return 'unknown'
  return totalPrice <= cap ? 'under' : 'over'
}

export function formatCurrency(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

export function getSwapActions(category: string): Array<{ key: SwapActionKey; label: string }> {
  const lowerCategory = category.toLowerCase()

  if (lowerCategory === 'shoes' || lowerCategory === 'footwear') {
    return [
      { key: 'cheaper', label: 'Cheaper' },
      { key: 'flats_instead', label: 'Flats instead' },
      { key: 'dressier', label: 'Dressier' },
      { key: 'different_colour', label: 'Different colour' },
    ]
  }

  return [
    { key: 'cheaper', label: 'Cheaper' },
    { key: 'dressier', label: 'Dressier' },
    { key: 'more_casual', label: 'More casual' },
    { key: 'different_colour', label: 'Different colour' },
  ]
}
