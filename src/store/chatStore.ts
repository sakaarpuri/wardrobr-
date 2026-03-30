import { create } from 'zustand'
import { Message, OutfitBoard, Product } from '@/lib/types'
import { UserProfile, getEmptyUserProfile } from '@/lib/shopper'

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
  /** Message submitted from the homepage hero, auto-fired when the workspace mounts */
  pendingMessage: PendingMessage | null
  /** Start listening as soon as the in-page workspace opens */
  pendingVoiceStart: boolean

  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message
  setLoading: (loading: boolean) => void
  setCurrentBoard: (board: OutfitBoard | null) => void
  setOccasionContext: (context: string | null) => void
  setUserProfile: (profile: Partial<UserProfile>) => void
  setPendingMessage: (msg: PendingMessage | null) => void
  setPendingVoiceStart: (enabled: boolean) => void
  /** Replace one product in a specific board (used by swap feature) */
  swapBoardProduct: (boardId: string, oldProductId: string, newProduct: Product) => void
  clearChat: () => void
  updateLastMessage: (updates: Partial<Message>) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  currentBoard: null,
  occasionContext: null,
  userProfile: getEmptyUserProfile(),
  pendingMessage: null,
  pendingVoiceStart: false,

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

  setPendingVoiceStart: (enabled) => set({ pendingVoiceStart: enabled }),

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

  clearChat: () => set({ messages: [], currentBoard: null, occasionContext: null, pendingMessage: null, pendingVoiceStart: false }),

  updateLastMessage: (updates) =>
    set((state) => {
      const messages = [...state.messages]
      if (messages.length === 0) return state
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...updates }
      return { messages }
    }),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...updates } : message
      ),
    })),
}))
