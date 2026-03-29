'use client'

import { useState } from 'react'
import { OutfitBoard as OutfitBoardType, Product } from '@/lib/types'
import { ProductCard } from './ProductCard'
import { SwapModal } from './SwapModal'
import { ImageDown, Mail, Loader2, ShoppingBag } from 'lucide-react'
import { motion } from 'framer-motion'
import { useChatStore } from '@/store/chatStore'
import { track } from '@/lib/posthog'
import { SwapActionKey, formatCurrency } from '@/lib/shopper'

interface OutfitBoardProps {
  board: OutfitBoardType
}

export function OutfitBoard({ board }: OutfitBoardProps) {
  const { occasionContext, swapBoardProduct, userProfile } = useChatStore()

  // Swap state
  const [swappingProductId, setSwappingProductId] = useState<string | null>(null)
  const [swapAlternatives, setSwapAlternatives] = useState<{
    product: Product
    alternatives: Product[]
    actionLabel?: string
  } | null>(null)

  // Share state
  const [isSharing, setIsSharing] = useState(false)

  // Email state
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleReplace = async (product: Product, action: SwapActionKey = 'same_vibe') => {
    setSwappingProductId(product.id)
    try {
      const res = await fetch('/api/style/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          currentPrice: product.price,
          currentStore: product.storeName,
          category: product.category,
          occasionContext,
          action,
          profile: userProfile,
        }),
      })
      if (!res.ok) throw new Error('Swap failed')
      const { alternatives, actionLabel } = await res.json()
      setSwapAlternatives({ product, alternatives, actionLabel })
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

  const totalPrice = board.totalPrice ?? board.products.reduce((sum, product) => sum + product.price, 0)
  const isShortlist = board.boardType === 'shortlist'
  const prices = board.products.map((product) => product.price)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
  const shortlistBudgetCopy =
    board.budgetRemaining !== null && board.budgetRemaining !== undefined
      ? board.budgetRemaining >= 0
        ? `Most expensive pick leaves ${formatCurrency(board.budgetRemaining)} headroom.`
        : `Most expensive pick is ${formatCurrency(Math.abs(board.budgetRemaining))} over budget.`
      : null
  const budgetTone =
    board.budgetStatus === 'over'
      ? 'border-rose-400/30 bg-rose-400/10 text-rose-100'
      : board.budgetStatus === 'under'
      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
      : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)]'

  // Fewer columns on mobile makes comparison easier for shoppers.
  const gridCols =
    board.products.length <= 2
      ? 'grid-cols-2'
      : board.products.length === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : 'grid-cols-2 sm:grid-cols-4'

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
            <h3 className="text-[var(--text)] font-semibold text-base">{board.title}</h3>
            {board.occasion && (
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{board.occasion}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Open all shop links at once */}
            <button
              onClick={() => board.products.forEach(p => window.open(p.affiliateUrl || p.productUrl, '_blank'))}
              className="flex items-center gap-1.5 text-[#E8A94A]/70 hover:text-[#E8A94A] text-xs transition-colors px-2 py-1 rounded-lg hover:bg-[#E8A94A]/8 border border-[#E8A94A]/20 hover:border-[#E8A94A]/40"
              title="Open all shop pages"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Shop all</span>
            </button>

            <button
              onClick={handleShare}
              disabled={isSharing}
              className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text)] text-xs transition-colors p-1 disabled:opacity-40"
              title="Save as image"
            >
              {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageDown className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              onClick={() => setShowEmailInput(!showEmailInput)}
              className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text)] text-xs transition-colors p-1"
              title="Email this board"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Email</span>
            </button>
          </div>
        </div>

        {(board.styleNote || board.budgetLabel || totalPrice > 0) && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                {isShortlist
                  ? `${board.products.length} picks${minPrice === maxPrice ? ` · ${formatCurrency(maxPrice)} each` : ` · ${formatCurrency(minPrice)}-${formatCurrency(maxPrice)} each`}`
                  : `Total ${formatCurrency(totalPrice)}`}
              </span>
              {board.budgetLabel && (
                <span className={`rounded-full border px-3 py-1 text-[11px] ${budgetTone}`}>
                  {board.budgetStatus === 'over' ? 'Over' : board.budgetStatus === 'under' ? 'Within' : 'Budget'} {board.budgetLabel}
                </span>
              )}
            </div>
            {board.styleNote && (
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">{board.styleNote}</p>
            )}
            {isShortlist && (
              <p className="text-[11px] text-[var(--text-faint)]">
                This is a shortlist in one category, so pricing is shown per pick rather than as one outfit total.
              </p>
            )}
            {board.budgetCap !== null && board.budgetCap !== undefined && (
              <p className="text-[11px] text-[var(--text-faint)]">
                {board.budgetRemaining !== null && board.budgetRemaining !== undefined
                  ? isShortlist
                    ? shortlistBudgetCopy
                    : `Budget remaining ${formatCurrency(Math.max(board.budgetRemaining, 0))}`
                  : `Budget cap ${formatCurrency(board.budgetCap)}`}
              </p>
            )}
            {board.warnings && board.warnings.length > 0 && (
              <div className="space-y-1">
                {board.warnings.map((warning) => (
                  <p key={warning} className="text-[11px] text-[var(--text-faint)]">
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email capture */}
        {showEmailInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            {emailStatus === 'sent' ? (
              <p className="text-[var(--text-muted)] text-xs py-2">
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
                  className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text)] text-xs placeholder-[var(--text-faint)] outline-none focus:border-[var(--border-hover)]"
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
        <p className="text-[var(--text-faint)] text-xs text-right">Styled by Wardrobr.ai</p>
      </motion.div>

      {/* Swap Modal */}
      {swapAlternatives && (
        <SwapModal
          alternatives={swapAlternatives.alternatives}
          actionLabel={swapAlternatives.actionLabel}
          onSelect={handleSwapSelect}
          onClose={() => setSwapAlternatives(null)}
        />
      )}
    </>
  )
}
