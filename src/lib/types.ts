import type { UserProfile } from './shopper'

export type MessageType =
  | 'user_text'
  | 'user_image'
  | 'ai_text'
  | 'ai_clarification'
  | 'ai_product_card'
  | 'ai_product_stream'
  | 'ai_outfit_board'
  | 'ai_style_analysis'
  | 'system_loading'

export interface Product {
  id: string
  name: string
  brand: string
  price: number
  currency: string
  imageUrl: string
  images?: string[]        // additional product photos (carousel)
  productUrl: string
  affiliateUrl: string
  storeName: string
  category: string
  description?: string
  aiExplanation?: string
  decisionNote?: string
  watchoutNote?: string
  brandSubstitutionNote?: string
  fitGuidance?: {
    text: string
    confidence: 'low' | 'medium' | 'high'
    source: 'feed' | 'heuristic' | 'brand_map'
  }
  decisionBadges?: string[]
}

export interface StyleAnalysis {
  colours: string[]
  categories: string[]
  styleTags: string[]
  formality: 'casual' | 'smart-casual' | 'formal' | 'athletic' | 'streetwear'
  season: string[]
  description: string
}

export interface OutfitBoard {
  id: string
  title: string
  products: Product[]
  boardType?: 'outfit' | 'shortlist'
  styleAnalysis?: StyleAnalysis
  styleNote?: string
  createdAt: string
  occasion?: string
  totalPrice?: number
  budgetCap?: number | null
  budgetLabel?: string | null
  budgetRemaining?: number | null
  budgetStatus?: 'under' | 'over' | 'unknown'
  warnings?: string[]
  brandRequest?: string | null
  brandSubstitutionNote?: string | null
  bestOverallProductId?: string | null
  bestBudgetProductId?: string | null
  closestBrandMatchProductId?: string | null
  quickRefineActions?: Array<{
    label: string
    prompt: string
  }>
}

export interface ClarificationOption {
  id: string
  label: string
  helper?: string
  profilePatch?: Partial<Pick<UserProfile, 'mission' | 'tripPreference' | 'gender'>>
}

export interface ClarificationGroup {
  id: 'mission' | 'trip_preference' | 'gender'
  label: string
  options: ClarificationOption[]
  selectedOptionId?: string
}

export interface ClarificationPrompt {
  question: string
  groups: ClarificationGroup[]
  ctaLabel?: string
  isSubmitting?: boolean
}

export interface Message {
  id: string
  type: MessageType
  content?: string
  source?: 'typed' | 'voice'
  imageUrl?: string
  imageBase64?: string
  products?: Product[]
  outfitBoard?: OutfitBoard
  styleAnalysis?: StyleAnalysis
  clarification?: ClarificationPrompt
  timestamp: Date
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  currentBoard: OutfitBoard | null
}

export interface SearchProductsParams {
  query: string
  category?: string
  minPrice?: number
  maxPrice?: number
  gender?: 'men' | 'women' | 'unisex'
  region?: string
  limit?: number
}

export interface ProductSearchResult {
  products: Product[]
  total: number
  query: string
}
