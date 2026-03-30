import type { OutfitBoard, SessionStage } from './types'

export type SessionSignal =
  | 'board_generated'
  | 'product_swapped'
  | 'anchor_selected'
  | 'build_full_look'
  | 'save_board'
  | 'board_share'
  | 'board_email'
  | 'open_all_tabs'
  | 'shop_click'
  | 'handoff_opened'
  | 'board_resumed'
  | 'followup_prompt_accepted'

export interface ShoppingSessionState {
  sessionStage: SessionStage
  certaintyScore: number
  selectedProductId: string | null
  anchorProductId: string | null
  sessionBoardId: string | null
}

export function getEmptyShoppingSession(): ShoppingSessionState {
  return {
    sessionStage: 'discovering',
    certaintyScore: 0,
    selectedProductId: null,
    anchorProductId: null,
    sessionBoardId: null,
  }
}

function clampCertainty(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function deriveStageFromBoard(board: OutfitBoard, state: ShoppingSessionState): SessionStage {
  if (state.selectedProductId || board.readyToShop) {
    return 'ready_to_shop'
  }

  if (state.anchorProductId || board.boardType === 'outfit') {
    return 'building_look'
  }

  if (board.boardType === 'shortlist') {
    return 'comparing'
  }

  return 'discovering'
}

export function syncSessionFromBoard(
  board: OutfitBoard,
  previous: ShoppingSessionState
): ShoppingSessionState {
  const baseCertainty = board.boardType === 'shortlist'
    ? board.products.length > 1 ? 30 : 48
    : board.products.length > 0 ? 58 : 20

  const nextState: ShoppingSessionState = {
    ...previous,
    certaintyScore: clampCertainty(Math.max(previous.certaintyScore, baseCertainty)),
    sessionBoardId: previous.sessionBoardId ?? board.id,
  }

  nextState.sessionStage = deriveStageFromBoard(board, nextState)
  return nextState
}

export function applySessionSignal(
  state: ShoppingSessionState,
  signal: SessionSignal,
  options: {
    board?: OutfitBoard | null
    productId?: string | null
  } = {}
): ShoppingSessionState {
  const next = { ...state }

  switch (signal) {
    case 'board_generated':
      next.certaintyScore = clampCertainty(next.certaintyScore + 8)
      break
    case 'product_swapped':
      next.certaintyScore = clampCertainty(next.certaintyScore + 6)
      next.sessionStage = 'comparing'
      break
    case 'anchor_selected':
      next.selectedProductId = options.productId ?? next.selectedProductId
      next.certaintyScore = clampCertainty(next.certaintyScore + 18)
      next.sessionStage = 'ready_to_shop'
      break
    case 'build_full_look':
      next.anchorProductId = options.productId ?? next.anchorProductId
      next.selectedProductId = options.productId ?? next.selectedProductId
      next.certaintyScore = clampCertainty(next.certaintyScore + 20)
      next.sessionStage = 'building_look'
      break
    case 'save_board':
    case 'board_share':
    case 'board_email':
      next.certaintyScore = clampCertainty(next.certaintyScore + 12)
      break
    case 'open_all_tabs':
    case 'shop_click':
    case 'handoff_opened':
      next.certaintyScore = clampCertainty(next.certaintyScore + 28)
      next.sessionStage = 'ready_to_shop'
      break
    case 'board_resumed':
      next.certaintyScore = clampCertainty(Math.max(next.certaintyScore, 42))
      break
    case 'followup_prompt_accepted':
      next.certaintyScore = clampCertainty(next.certaintyScore + 5)
      break
  }

  if (options.board) {
    const synced = syncSessionFromBoard(options.board, next)
    synced.selectedProductId = next.selectedProductId
    synced.anchorProductId = next.anchorProductId
    synced.sessionStage = deriveStageFromBoard(options.board, synced)
    return synced
  }

  return next
}
