import { create } from 'zustand'
import { Message, OutfitBoard, Product } from '@/lib/types'

export interface UserProfile {
  gender: 'women' | 'men' | null
  size: string | null       // e.g. "10", "M", "L"
  budget: string | null     // e.g. "£50–150"
}

export interface PendingMessage {
  text: string
  imageBase64?: string
  imageMimeType?: string
  imagePreview?: string
}

interface ChatStore {
  messages: Message[]
  isLoading: boolean
  currentBoard: OutfitBoard | null
  /** Last user text message — used as occasion context for swap requests */
  occasionContext: string | null
  /** User style profile — injected as context into every Gemini request */
  userProfile: UserProfile
  /** Message submitted on the homepage, auto-fired when /style mounts */
  pendingMessage: PendingMessage | null

  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message
  setLoading: (loading: boolean) => void
  setCurrentBoard: (board: OutfitBoard | null) => void
  setOccasionContext: (context: string | null) => void
  setUserProfile: (profile: Partial<UserProfile>) => void
  setPendingMessage: (msg: PendingMessage | null) => void
  /** Replace one product in a specific board (used by swap feature) */
  swapBoardProduct: (boardId: string, oldProductId: string, newProduct: Product) => void
  clearChat: () => void
  updateLastMessage: (updates: Partial<Message>) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  currentBoard: null,
  occasionContext: null,
  userProfile: { gender: null, size: null, budget: null },
  pendingMessage: null,

  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: globalThis.crypto.randomUUID(),
      timestamp: new Date(),
    }
    set((state) => ({ messages: [...state.messages, newMessage] }))
    return newMessage
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setCurrentBoard: (board) => set({ currentBoard: board }),

  setOccasionContext: (context) => set({ occasionContext: context }),

  setUserProfile: (profile) =>
    set((state) => ({ userProfile: { ...state.userProfile, ...profile } })),

  setPendingMessage: (msg) => set({ pendingMessage: msg }),

  swapBoardProduct: (boardId, oldProductId, newProduct) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.type !== 'ai_outfit_board' || m.outfitBoard?.id !== boardId) return m
        return {
          ...m,
          outfitBoard: {
            ...m.outfitBoard!,
            products: m.outfitBoard!.products.map((p) =>
              p.id === oldProductId ? newProduct : p
            ),
          },
        }
      }),
      currentBoard:
        state.currentBoard?.id === boardId
          ? {
              ...state.currentBoard,
              products: state.currentBoard.products.map((p) =>
                p.id === oldProductId ? newProduct : p
              ),
            }
          : state.currentBoard,
    })),

  clearChat: () => set({ messages: [], currentBoard: null, occasionContext: null }),

  updateLastMessage: (updates) =>
    set((state) => {
      const messages = [...state.messages]
      if (messages.length === 0) return state
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...updates }
      return { messages }
    }),
}))

/** Build a profile context string to prepend to Gemini messages */
export function buildProfileContext(profile: UserProfile): string {
  const parts: string[] = []
  if (profile.gender) parts.push(`Shopping for ${profile.gender}'s clothing`)
  if (profile.size) parts.push(`UK size ${profile.size}`)
  if (profile.budget) parts.push(`budget ${profile.budget}`)
  if (parts.length === 0) return ''
  return `[Shopper profile: ${parts.join(', ')}]`
}
