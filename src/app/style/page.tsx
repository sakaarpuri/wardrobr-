'use client'

import Link from 'next/link'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { useChatStore } from '@/store/chatStore'
import { Trash2 } from 'lucide-react'

export default function StylePage() {
  const { clearChat, messages } = useChatStore()

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <Link href="/" className="text-white font-semibold tracking-tight text-sm">
          Wardrobr.ai
        </Link>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </header>

      {/* Chat fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  )
}
