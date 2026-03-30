'use client'

import { useRouter } from 'next/navigation'
import type { OutfitBoard } from '@/lib/types'
import { useChatStore } from '@/store/chatStore'
import { recordMemberEvent } from '@/lib/member-memory-client'

export function ResumeSavedBoardButton({
  board,
  savedBoardId,
}: {
  board: OutfitBoard
  savedBoardId: string
}) {
  const router = useRouter()
  const { clearChat, hydrateSavedBoard } = useChatStore()

  return (
    <button
      type="button"
      onClick={() => {
        clearChat()
        hydrateSavedBoard(board)
        void recordMemberEvent('board_resumed', {
          boardId: savedBoardId,
          metadata: {
            title: board.title,
            occasion: board.occasion ?? null,
          },
        })
        router.push('/?workspace=1')
      }}
      className="inline-flex items-center gap-2 rounded-full border border-[#E8A94A]/35 bg-[#E8A94A]/10 px-4 py-2 text-sm font-medium text-[#E8A94A] transition-colors hover:border-[#E8A94A]/55"
    >
      Continue this look
    </button>
  )
}
