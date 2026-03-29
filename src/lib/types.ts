export type MessageType =
  | 'user_text'
  | 'user_image'
  | 'ai_text'
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
  styleAnalysis?: StyleAnalysis
  createdAt: string
  occasion?: string
}

export interface Message {
  id: string
  type: MessageType
  content?: string
  imageUrl?: string
  imageBase64?: string
  products?: Product[]
  outfitBoard?: OutfitBoard
  styleAnalysis?: StyleAnalysis
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
