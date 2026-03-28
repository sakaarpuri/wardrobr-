'use client'

import { useState } from 'react'
import { OutfitBoard as OutfitBoardType, Product } from '@/lib/types'
import { ProductCard } from './ProductCard'
import { SwapModal } from './SwapModal'
import { ImageDown, Mail, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useChatStore } from '@/store/chatStore'
import { track } from '@/lib/posthog'

interface OutfitBoardProps {
  board: OutfitBoardType
  compact?: boolean
}

export function OutfitBoard({ board, compact = false }: OutfitBoardProps) {
  const { occasionContext, swapBoardProduct } = useChatStore()

  // Swap state
  const [swappingProductId, setSwappingProductId] = useState<string | null>(null)
  const [swapAlternatives, setSwapAlternatives] = useState<{
    product: Product
    alternatives: Product[]
  } | null>(null)

  // Share state
  const [isSharing, setIsSharing] = useState(false)

  // Email state
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleReplace = async (product: Product) => {
    setSwappingProductId(product.id)
    try {
      const res = await fetch('/api/style/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          category: product.category,
          occasionContext,
        }),
      })
      if (!res.ok) throw new Error('Swap failed')
      const { alternatives } = await res.json()
      setSwapAlternatives({ product, alternatives })
    } catch (error) {
      console.error('Replace error:', error)
    } finally {
      setSwappingProductId(null)
    }
  }

  const handleSwapSelect = (newProduct: Product) => {
    if (!swapAlternatives) return
    swapBoardProduct(board.id, swapAlternatives.product.id, newProduct)
    setSwapAlternatives(null)
    track('product_swapped', { board_id: board.id, occasion: board.occasion })
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const res = await fetch('/api/board/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: board.products,
          title: board.title,
          occasion: board.occasion,
        }),
      })
      if (!res.ok) throw new Error('Share failed')

      const blob = await res.blob()
      const file = new File([blob], `${board.title.replace(/\s+/g, '-')}.png`, {
        type: 'image/png',
      })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `My look for ${board.occasion ?? board.title} — styled by wardrobr.ai`,
        })
      } else {
        // Desktop fallback: download the PNG
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }

      track('board_shared', { occasion_type: board.occasion })
    } catch (error) {
      console.error('Share error:', error)
    } finally {
      setIsSharing(false)
    }
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || emailStatus === 'sending') return
    setEmailStatus('sending')
    try {
      const res = await fetch('/api/board/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          products: board.products,
          title: board.title,
          occasion: board.occasion,
        }),
      })
      if (!res.ok) throw new Error('Email failed')
      setEmailStatus('sent')
      track('board_emailed', { occasion_type: board.occasion })
    } catch {
      setEmailStatus('error')
    }
  }

  // Always prefer more columns — smaller, gallery-style cards
  const gridCols =
    board.products.length <= 3
      ? 'grid-cols-3'
      : board.products.length === 4
      ? 'grid-cols-4'
      : 'grid-cols-3'

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="space-y-3"
      >
        {/* Board Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-semibold text-base">{board.title}</h3>
            {board.occasion && (
              <p className="text-white/40 text-xs mt-0.5">{board.occasion}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors p-1 disabled:opacity-40"
              title="Save as image"
            >
              {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageDown className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Save look</span>
            </button>

            <button
              onClick={() => setShowEmailInput(!showEmailInput)}
              className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors p-1"
              title="Email this board"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Email</span>
            </button>
          </div>
        </div>

        {/* Email capture */}
        {showEmailInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            {emailStatus === 'sent' ? (
              <p className="text-white/60 text-xs py-2">
                ✓ Board sent to {email} — check your inbox
              </p>
            ) : (
              <form onSubmit={handleEmail} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder-white/30 outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  disabled={emailStatus === 'sending'}
                  className="bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {emailStatus === 'sending' ? 'Sending…' : 'Send'}
                </button>
              </form>
            )}
            {emailStatus === 'error' && (
              <p className="text-red-400 text-xs mt-1">Something went wrong — try again</p>
            )}
          </motion.div>
        )}

        {/* Product Grid */}
        <div className={`grid ${gridCols} gap-2`}>
          {board.products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
            >
              <ProductCard
                product={product}
                onReplace={handleReplace}
                isSwapping={swappingProductId === product.id}
              />
            </motion.div>
          ))}
        </div>

        {/* Watermark */}
        <p className="text-white/20 text-xs text-right">Styled by Wardrobr.ai</p>
      </motion.div>

      {/* Swap Modal */}
      {swapAlternatives && (
        <SwapModal
          alternatives={swapAlternatives.alternatives}
          onSelect={handleSwapSelect}
          onClose={() => setSwapAlternatives(null)}
        />
      )}
    </>
  )
}
