import { create } from 'zustand'
import { Message, OutfitBoard, Product } from '@/lib/types'

interface ChatStore {
  messages: Message[]
  isLoading: boolean
  currentBoard: OutfitBoard | null
  /** Last user text message — used as occasion context for swap requests */
  occasionContext: string | null
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message
  setLoading: (loading: boolean) => void
  setCurrentBoard: (board: OutfitBoard | null) => void
  setOccasionContext: (context: string | null) => void
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
