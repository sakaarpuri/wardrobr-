'use client'

import { Message } from '@/lib/types'
import { OutfitBoard } from '@/components/board/OutfitBoard'
import { ProductCard } from '@/components/board/ProductCard'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatMessageProps {
  message: Message
}

// Sequentially pulsing dots — fashion editorial loading indicator
function PulsingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1 h-1 rounded-full bg-[var(--text-muted)]"
          animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.6, 1.4, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type === 'user_text' || message.type === 'user_image'
  const isLoading = message.type === 'system_loading'

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="py-3 space-y-2"
      >
        {/* Animated status label */}
        <div className="flex items-center gap-3">
          <PulsingDots />
          <AnimatePresence mode="wait">
            <motion.p
              key={message.content ?? 'loading'}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.25 }}
              className="font-display italic text-[var(--text-muted)] text-sm"
            >
              {message.content ?? 'Styling your look…'}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Thin shimmer bar */}
        <div className="h-px w-40 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent overflow-hidden rounded-full">
          <motion.div
            className="h-full w-1/3 bg-[var(--text-muted)] rounded-full"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
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

  // Live product stream — horizontal scroll while Gemini searches
  if (message.type === 'ai_product_stream' && message.products && message.products.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="py-1"
      >
        <div className="font-display italic text-[var(--text-faint)] text-xs mb-2 flex items-center gap-2">
          <PulsingDots />
          Finding pieces…
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {message.products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="flex-shrink-0 w-28"
            >
              <ProductCard product={product} />
            </motion.div>
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
            ? 'bg-[var(--text)] text-[var(--bg)]'
            : 'bg-[var(--bg-card)] text-[var(--text)] border border-[var(--border)]'
          }
        `}
      >
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Uploaded look"
            className="max-h-48 rounded-xl object-cover mb-2"
          />
        )}
        {message.content && (
          <p className="whitespace-pre-wrap font-display italic text-sm">{message.content}</p>
        )}
      </div>
    </motion.div>
  )
}
