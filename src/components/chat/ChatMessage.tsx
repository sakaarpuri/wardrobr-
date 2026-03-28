'use client'

import { Message } from '@/lib/types'
import { OutfitBoard } from '@/components/board/OutfitBoard'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type === 'user_text' || message.type === 'user_image'
  const isLoading = message.type === 'system_loading'

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2.5 text-white/50 text-sm py-2"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        <motion.span
          key={message.content ?? 'loading'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {message.content ?? 'Styling your look…'}
        </motion.span>
      </motion.div>
    )
  }

  if (message.type === 'ai_outfit_board' && message.outfitBoard) {
    return (
      <div className="py-2">
        <OutfitBoard board={message.outfitBoard} />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-white text-black'
            : 'bg-zinc-900 text-white/90 border border-white/5'
          }
        `}
      >
        {/* Image preview */}
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Uploaded look"
            className="max-h-48 rounded-xl object-cover mb-2"
          />
        )}

        {/* Text content */}
        {message.content && (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </motion.div>
  )
}
