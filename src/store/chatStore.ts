import { create } from 'zustand'
import { Message, OutfitBoard, Product } from '@/lib/types'
import { UserProfile, getEmptyUserProfile } from '@/lib/shopper'
import { applySessionSignal, getEmptyShoppingSession, syncSessionFromBoard, type SessionSignal } from '@/lib/session-engine'

export interface PendingMessage {
  text: string
  imageBase64?: string
  imageMimeType?: string
  imagePreview?: string
  anchorProduct?: Product
}

interface ChatStore {
  messages: Message[]
  isLoading: boolean
  currentBoard: OutfitBoard | null
  sessionStage: 'discovering' | 'comparing' | 'building_look' | 'ready_to_shop'
  certaintyScore: number
  selectedProductId: string | null
  anchorProductId: string | null
  sessionBoardId: string | null
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
  setCurrentBoard: (board: OutfitBoard | null, options?: { preserveSelection?: boolean }) => void
  setOccasionContext: (context: string | null) => void
  setUserProfile: (profile: Partial<UserProfile>) => void
  setPendingMessage: (msg: PendingMessage | null) => void
  setPendingVoiceStart: (enabled: boolean) => void
  setSelectedProductId: (productId: string | null) => void
  setAnchorProductId: (productId: string | null) => void
  trackSessionSignal: (signal: SessionSignal, options?: { board?: OutfitBoard | null; productId?: string | null }) => void
  hydrateSavedBoard: (board: OutfitBoard) => void
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
  ...getEmptyShoppingSession(),
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

  setCurrentBoard: (board, options) =>
    set((state) => {
      if (!board) {
        return {
          currentBoard: null,
          ...getEmptyShoppingSession(),
        }
      }

      const syncedSession = syncSessionFromBoard(board, {
        sessionStage: state.sessionStage,
        certaintyScore: state.certaintyScore,
        selectedProductId: state.selectedProductId,
        anchorProductId: state.anchorProductId,
        sessionBoardId: state.sessionBoardId,
      })
      const preservedSelection =
        options?.preserveSelection && state.selectedProductId && board.products.some((product) => product.id === state.selectedProductId)
          ? state.selectedProductId
          : null

      return {
        currentBoard: board,
        sessionStage: syncedSession.sessionStage,
        certaintyScore: syncedSession.certaintyScore,
        selectedProductId: preservedSelection,
        anchorProductId: syncedSession.anchorProductId,
        sessionBoardId: syncedSession.sessionBoardId,
      }
    }),

  setOccasionContext: (context) => set({ occasionContext: context }),

  setUserProfile: (profile) =>
    set((state) => ({ userProfile: { ...state.userProfile, ...profile } })),

  setPendingMessage: (msg) => set({ pendingMessage: msg }),

  setPendingVoiceStart: (enabled) => set({ pendingVoiceStart: enabled }),

  setSelectedProductId: (productId) =>
    set((state) => {
      const board = state.currentBoard
      const session = applySessionSignal(
        {
          sessionStage: state.sessionStage,
          certaintyScore: state.certaintyScore,
          selectedProductId: state.selectedProductId,
          anchorProductId: state.anchorProductId,
          sessionBoardId: state.sessionBoardId,
        },
        'anchor_selected',
        { board, productId }
      )

      return {
        selectedProductId: productId,
        sessionStage: session.sessionStage,
        certaintyScore: session.certaintyScore,
        anchorProductId: session.anchorProductId,
        sessionBoardId: session.sessionBoardId,
      }
    }),

  setAnchorProductId: (productId) =>
    set((state) => ({
      anchorProductId: productId,
      selectedProductId: productId ?? state.selectedProductId,
    })),

  trackSessionSignal: (signal, options) =>
    set((state) => {
      const session = applySessionSignal(
        {
          sessionStage: state.sessionStage,
          certaintyScore: state.certaintyScore,
          selectedProductId: state.selectedProductId,
          anchorProductId: state.anchorProductId,
          sessionBoardId: state.sessionBoardId,
        },
        signal,
        {
          board: options?.board ?? state.currentBoard,
          productId: options?.productId,
        }
      )

      return {
        sessionStage: session.sessionStage,
        certaintyScore: session.certaintyScore,
        selectedProductId: session.selectedProductId,
        anchorProductId: session.anchorProductId,
        sessionBoardId: session.sessionBoardId,
      }
    }),

  hydrateSavedBoard: (board) =>
    set((state) => {
      const session = applySessionSignal(
        syncSessionFromBoard(board, {
          ...getEmptyShoppingSession(),
          sessionBoardId: board.id,
        }),
        'board_resumed',
        { board }
      )

      return {
        messages: [...state.messages, {
          id: globalThis.crypto.randomUUID(),
          type: 'ai_outfit_board',
          outfitBoard: board,
          timestamp: new Date(),
        }],
        currentBoard: board,
        occasionContext: board.occasion ?? board.title,
        sessionStage: session.sessionStage,
        certaintyScore: session.certaintyScore,
        selectedProductId: session.selectedProductId,
        anchorProductId: session.anchorProductId,
        sessionBoardId: session.sessionBoardId,
      }
    }),

  swapBoardProduct: (boardId, oldProductId, newProduct) =>
    set((state) => {
      const nextBoard =
        state.currentBoard?.id === boardId
          ? {
              ...state.currentBoard,
              products: state.currentBoard.products.map((p) =>
                p.id === oldProductId ? newProduct : p
              ),
            }
          : state.currentBoard
      const session = applySessionSignal({
        sessionStage: state.sessionStage,
        certaintyScore: state.certaintyScore,
        selectedProductId: state.selectedProductId,
        anchorProductId: state.anchorProductId,
        sessionBoardId: state.sessionBoardId,
      }, 'product_swapped', { board: nextBoard })

      return {
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
        currentBoard: nextBoard,
        certaintyScore: session.certaintyScore,
        sessionStage: session.sessionStage,
        selectedProductId: state.selectedProductId === oldProductId ? newProduct.id : state.selectedProductId,
        anchorProductId: state.anchorProductId === oldProductId ? newProduct.id : state.anchorProductId,
        sessionBoardId: session.sessionBoardId,
      }
    }),

  clearChat: () => set({ messages: [], currentBoard: null, occasionContext: null, pendingMessage: null, pendingVoiceStart: false, ...getEmptyShoppingSession() }),

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
