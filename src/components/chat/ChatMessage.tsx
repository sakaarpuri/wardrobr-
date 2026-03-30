'use client'

import Image from 'next/image'
import { Message } from '@/lib/types'
import { OutfitBoard } from '@/components/board/OutfitBoard'
import { ProductCard } from '@/components/board/ProductCard'
import { ClarificationCard } from './ClarificationCard'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatMessageProps {
  message: Message
  onClarificationSelect?: (message: Message, groupId: string, optionId: string) => void
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

export function ChatMessage({ message, onClarificationSelect }: ChatMessageProps) {
  if (message.type === 'user_text' && message.source === 'voice') {
    return null
  }

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
              {message.content ?? 'Working on it…'}
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
        className="py-1.5"
      >
        <div className="mb-2 flex items-center gap-2 font-display italic text-sm text-[var(--text-faint)] sm:text-xs">
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
              className="w-32 flex-shrink-0 sm:w-28"
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
          max-w-[92%] rounded-2xl px-4 py-3.5 text-[16px] leading-relaxed sm:max-w-[85%] sm:py-3 sm:text-sm
          ${isUser
            ? 'bg-[var(--text)] text-[var(--bg)]'
            : 'bg-[var(--bg-card)] text-[var(--text)] border border-[var(--border)]'
          }
        `}
      >
        {message.imageUrl && (
          <Image
            src={message.imageUrl}
            alt="Uploaded look"
            width={180}
            height={140}
            unoptimized
            className="mb-2 max-h-32 w-auto rounded-xl object-cover"
          />
        )}
        {message.content && (
          <p className="whitespace-pre-wrap font-display italic text-base sm:text-sm">{message.content}</p>
        )}
        {message.type === 'ai_clarification' && message.clarification && onClarificationSelect && (
          <div className={`${message.content ? 'mt-4 border-t border-[var(--border)] pt-4' : ''}`}>
            <ClarificationCard
              clarification={message.clarification}
              onSelect={(groupId, optionId) => onClarificationSelect(message, groupId, optionId)}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
