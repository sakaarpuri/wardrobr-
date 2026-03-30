'use client'

import type { OutfitBoard, Product } from './types'
import type { MemberPreferences, MemoryEventType } from './member-memory'

function toJson(value: unknown) {
  return JSON.stringify(value)
}

export async function recordMemberEvent(
  eventType: MemoryEventType,
  payload: {
    boardId?: string
    product?: Product
    metadata?: Record<string, unknown>
  } = {}
) {
  try {
    await fetch('/api/member/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: toJson({
        eventType,
        boardId: payload.boardId,
        productId: payload.product?.id,
        storeName: payload.product?.storeName,
        brand: payload.product?.brand,
        category: payload.product?.category,
        price: payload.product?.price,
        metadata: payload.metadata ?? {},
      }),
    })
  } catch {
    // Member memory should never block shopping.
  }
}

export async function saveBoardForMember(board: OutfitBoard) {
  const response = await fetch('/api/member/saved-boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: toJson({ board }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? 'Could not save board')
  }

  return response.json()
}

export async function updateMemberPreferences(preferences: Partial<MemberPreferences>) {
  const response = await fetch('/api/member/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: toJson(preferences),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? 'Could not update preferences')
  }

  return response.json()
}
