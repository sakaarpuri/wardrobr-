'use client'

import { Message } from '@/lib/types'
import { OutfitBoard } from '@/components/board/OutfitBoard'
import { ProductCard } from '@/components/board/ProductCard'
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

  // Live product stream — horizontal scroll row of cards while Gemini searches
  if (message.type === 'ai_product_stream' && message.products && message.products.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="py-1"
      >
        <p className="text-white/30 text-xs mb-2 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Finding pieces…
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {message.products.map((product) => (
            <div key={product.id} className="flex-shrink-0 w-36">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </motion.div>
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
