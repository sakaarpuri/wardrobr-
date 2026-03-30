export type ShopperMission = 'full_look' | 'hero_piece' | 'match_photo' | 'style_existing'
export type BudgetScope = 'total' | 'per_item'
export type OccasionStrictness = 'relaxed' | 'balanced' | 'strict'
export type TripPreference = 'daytime' | 'mixed' | 'dressy'
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
  budgetMax: number | null
  budgetScope: BudgetScope
  mission: ShopperMission | null
  tripPreference: TripPreference | null
  fitNotes: string | null
  occasionStrictness: OccasionStrictness | null
}

export const BUDGET_OPTIONS = ['Under £50', '£50–150', '£150–300', '£300+'] as const
export const WOMENS_SIZE_OPTIONS = ['6', '8', '10', '12', '14', '16', '18', 'XS', 'S', 'M', 'L', 'XL'] as const
export const MENS_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '30', '32', '34', '36', '38'] as const
export const UNIVERSAL_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL'] as const
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
    budgetMax: null,
    budgetScope: 'total',
    mission: null,
    tripPreference: null,
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
  const budgetLabel = getBudgetLabel(profile)

  if (profile.mission) parts.push(`shopping mission: ${getMissionPrompt(profile.mission)}`)
  if (profile.tripPreference) parts.push(`trip mix: ${getTripPreferencePrompt(profile.tripPreference)}`)
  if (profile.gender) parts.push(`shopping for ${profile.gender}'s clothing`)
  if (profile.size) parts.push(`preferred UK size ${profile.size}`)
  if (profile.shoeSize) parts.push(`preferred UK shoe size ${profile.shoeSize}`)
  if (budgetLabel) parts.push(`${profile.budgetScope === 'per_item' ? 'per-item budget' : 'total budget'} ${budgetLabel}`)
  if (profile.fitNotes) parts.push(`fit notes: ${profile.fitNotes}`)
  if (profile.occasionStrictness) parts.push(`occasion strictness: ${profile.occasionStrictness}`)
  if (profile.mission && profile.tripPreference) parts.push('structured travel clarification complete, proceed without asking another follow-up question')

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

export function getSizeOptions(gender: UserProfile['gender']) {
  if (gender === 'women') return [...WOMENS_SIZE_OPTIONS] as string[]
  if (gender === 'men') return [...MENS_SIZE_OPTIONS] as string[]
  return [...UNIVERSAL_SIZE_OPTIONS] as string[]
}

export function isSizeCompatibleWithGender(size: string | null, gender: UserProfile['gender']) {
  if (!size) return true
  return getSizeOptions(gender).includes(size)
}

export function getTripPreferencePrompt(preference: TripPreference): string {
  switch (preference) {
    case 'daytime':
      return 'mostly relaxed daytime dressing'
    case 'dressy':
      return 'mostly dressier plans and evenings'
    case 'mixed':
    default:
      return 'a mix of casual daytime looks and dressier options'
  }
}

export function getTripPreferenceTitle(preference: TripPreference | null): string | null {
  if (!preference) return null
  switch (preference) {
    case 'daytime':
      return 'Daytime + casual'
    case 'dressy':
      return 'Dressier plans'
    case 'mixed':
    default:
      return 'Day + dinner mix'
  }
}

export function inferProfileFromReply(
  message: string,
  profile: UserProfile,
  lastAssistantText?: string | null
): Partial<UserProfile> {
  const text = message.trim().toLowerCase()
  const assistant = lastAssistantText?.trim().toLowerCase() ?? ''
  const next: Partial<UserProfile> = {}
  const hasOccasion = /(wedding|interview|job|office|party|date|holiday|trip|travel|brunch|festival|graduation|work|weekend|ceremony|gala|conference)/.test(text)
  const hasCategory = /(dress|blazer|jacket|coat|trousers|jeans|shoes|heels|sandals|bag|top|shirt|skirt|loafers|trainers|sneakers|suit|blouse|shorts)/.test(text)
  const mentionsMens = /\b(men|men's|mens|male|groom|husband|boyfriend|dad|father|brother|son)\b/.test(text)
  const mentionsWomens = /\b(women|women's|womens|woman|female|plus-size|curve|maternity|wife|girlfriend|mum|mom|mother|sister|bride)\b/.test(text)
  const stronglyMensCategory = /\b(suit|tie|tuxedo|oxford shirt|brogues|groom suit|best man)\b/.test(text)
  const stronglyWomensCategory = /\b(dress|heels|heel|skirt|bra|bralette|maternity|bridal|wedding guest dress)\b/.test(text)

  if (!text) return next

  if (!profile.mission) {
    if (/(full look|full outfit|complete look|whole outfit)/.test(text)) {
      next.mission = 'full_look'
    } else if (/\b(find me one|one hero|single pick|single item|one key item)\b/.test(text)) {
      next.mission = 'hero_piece'
    } else if (/(hero piece|one key item|one item|single item|single piece|key piece)/.test(text)) {
      next.mission = 'hero_piece'
    } else if (/(style what i own|style something i own|style what i have)/.test(text)) {
      next.mission = 'style_existing'
    } else if (hasOccasion && !hasCategory) {
      next.mission = 'full_look'
    }
  }

  if (!profile.tripPreference) {
    if (/\bboth\b|\bmixed\b|\ba mix\b|daytime and dinner|day and dinner|daytime \+ dinner|day and night|beach and dinner/.test(text)) {
      next.tripPreference = 'mixed'
    } else if (/(casual|relaxed|beach|walking|daytime|exploring)/.test(text) && !/(dressy|dressier|dinner|evening|formal)/.test(text)) {
      next.tripPreference = 'daytime'
    } else if (/(dressy|dressier|dinner|evening|formal)/.test(text) && !/(casual|relaxed|beach|walking|daytime|exploring)/.test(text)) {
      next.tripPreference = 'dressy'
    } else if (assistant.includes('relaxed') && assistant.includes('dressier') && /\bboth\b/.test(text)) {
      next.tripPreference = 'mixed'
    }
  }

  if (!profile.gender) {
    if (mentionsMens) {
      next.gender = 'men'
    } else if (mentionsWomens) {
      next.gender = 'women'
    } else if (stronglyMensCategory) {
      next.gender = 'men'
    } else if (stronglyWomensCategory) {
      next.gender = 'women'
    } else if (/\bwedding guest\b/.test(text) && !mentionsMens) {
      next.gender = 'women'
    }
  }

  if (!profile.budgetMax) {
    const exactBudgetMatch = text.match(/(?:under|below|max|maximum|budget(?: of)?|up to)\s*£?\s*(\d{2,4})/)
      ?? text.match(/£\s*(\d{2,4})\s*(?:max|budget)?/)
      ?? text.match(/(\d{2,4})\s*(?:quid|pounds)\s*(?:max|budget)?/)

    if (exactBudgetMatch) {
      const amount = Number(exactBudgetMatch[1])
      if (Number.isFinite(amount) && amount >= 20 && amount <= 5000) {
        next.budgetMax = amount
      }
    }
  }

  if (!profile.size) {
    const sizeMatch = text.match(/\bsize\s*(\d{1,2}|xs|s|m|l|xl)\b/)
    if (sizeMatch) {
      next.size = sizeMatch[1].toUpperCase()
    }
  }

  return next
}

export function isUnsupportedShopperSegment(message: string) {
  const text = message.trim().toLowerCase()
  return /\b(kids|kid|child|children|toddler|toddlers|baby|babies|newborn|school uniform)\b/.test(text)
}

export function isLikelyShoppingRelevant(message: string) {
  const text = message.trim().toLowerCase()
  return /(outfit|look|style|wear|shopping|shop|buy|bought|dress|blazer|jacket|coat|trousers|pants|jeans|shoes|heels|sandals|bag|top|shirt|skirt|loafers|trainers|sneakers|suit|blouse|shorts|wardrobe|capsule|wedding|interview|date|brunch|trip|travel|holiday|occasion|formal|casual|dressy|budget|size|fit)/.test(text)
}

export function isLikelyClarificationReply(
  message: string,
  profile: UserProfile,
  lastAssistantText?: string | null
): boolean {
  const text = message.trim()
  if (!text) return false

  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (wordCount > 5) return false

  return Object.keys(inferProfileFromReply(text, profile, lastAssistantText)).length > 0
}

export function getBudgetCap(label: string | null, budgetMax?: number | null): number | null {
  if (budgetMax && budgetMax > 0) return budgetMax
  if (!label) return null
  if (label === 'Under £50') return 50
  if (label === '£50–150') return 150
  if (label === '£150–300') return 300
  if (label === '£300+') return null
  return null
}

export function getSearchPriceCap(profile: UserProfile): number | null {
  const totalCap = getBudgetCap(profile.budget, profile.budgetMax)
  if (!totalCap) return null

  if (profile.budgetScope === 'per_item' || profile.mission === 'hero_piece') return totalCap

  const divisor = profile.mission === 'style_existing' ? 3 : 4
  return Math.max(15, Math.ceil(totalCap / divisor))
}

export function getBudgetStatus(totalPrice: number, budgetLabel: string | null, budgetMax?: number | null): 'under' | 'over' | 'unknown' {
  const cap = getBudgetCap(budgetLabel, budgetMax)
  if (!cap) return 'unknown'
  return totalPrice <= cap ? 'under' : 'over'
}

export function getBudgetLabel(profile: Pick<UserProfile, 'budget' | 'budgetMax'>): string | null {
  if (profile.budgetMax) return `Under £${profile.budgetMax}`
  return profile.budget
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
