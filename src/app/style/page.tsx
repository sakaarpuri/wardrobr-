'use client'

import Link from 'next/link'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { VoiceStyler } from '@/components/voice/VoiceStyler'
import { useChatStore } from '@/store/chatStore'
import { Trash2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function StylePage() {
  const { clearChat, messages } = useChatStore()

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <Link href="/" className="text-[var(--text)] font-semibold tracking-tight text-sm">
          Wardrobr.ai
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 text-[var(--text-faint)] hover:text-[var(--text-muted)] text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </header>

      {/* Chat fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>

      {/* Floating voice stylist button */}
      <VoiceStyler />
    </div>
  )
}
