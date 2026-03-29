'use client'

import { useState } from 'react'
import { Product } from '@/lib/types'
import { ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

const CATEGORY_STYLES: Record<string, { gradient: string; label: string }> = {
  tops:        { gradient: 'from-stone-800 to-stone-700',   label: 'Top' },
  bottoms:     { gradient: 'from-slate-800 to-slate-700',   label: 'Bottoms' },
  dresses:     { gradient: 'from-rose-950 to-rose-900',     label: 'Dress' },
  outerwear:   { gradient: 'from-zinc-800 to-zinc-700',     label: 'Outerwear' },
  shoes:       { gradient: 'from-amber-950 to-amber-900',   label: 'Shoes' },
  footwear:    { gradient: 'from-amber-950 to-amber-900',   label: 'Shoes' },
  bags:        { gradient: 'from-neutral-800 to-neutral-700', label: 'Bag' },
  accessories: { gradient: 'from-indigo-950 to-indigo-900', label: 'Accessory' },
}

function ImagePlaceholder({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category.toLowerCase()] ?? { gradient: 'from-zinc-800 to-zinc-700', label: category }
  return (
    <div className={`w-full h-full bg-gradient-to-b ${style.gradient} flex flex-col items-center justify-center gap-2`}>
      <div className="w-10 h-10 border border-white/10 rounded-full flex items-center justify-center">
        <span className="text-white/20 text-xs font-medium capitalize">{style.label.slice(0, 2)}</span>
      </div>
      <span className="text-white/20 text-xs capitalize tracking-wide">{style.label}</span>
    </div>
  )
}

interface ProductCardProps {
  product: Product
  onReplace?: (product: Product) => void
  isSwapping?: boolean
}

export function ProductCard({ product, onReplace, isSwapping }: ProductCardProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)

  const allImages = product.images && product.images.length > 1 ? product.images : [product.imageUrl]
  const currentImage = allImages[photoIdx]
  const hasMultiple = allImages.length > 1

  const prev = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPhotoIdx(i => (i - 1 + allImages.length) % allImages.length)
    setImgFailed(false)
  }
  const next = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPhotoIdx(i => (i + 1) % allImages.length)
    setImgFailed(false)
  }

  const formattedPrice = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: product.currency ?? 'GBP',
  }).format(product.price)

  const showPlaceholder = !currentImage || imgFailed

  return (
    <div className="group bg-[var(--bg-card)] rounded-2xl overflow-hidden border border-[var(--border)] hover:border-[var(--border-hover)] transition-all duration-300">
      {/* Product Image */}
      <div className="aspect-[3/4] bg-[var(--bg-subtle)] overflow-hidden relative">
        {showPlaceholder ? (
          <ImagePlaceholder category={product.category} />
        ) : (
          <img
            key={currentImage}
            src={currentImage}
            alt={product.name}
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={() => setImgFailed(true)}
          />
        )}

        {/* Carousel controls — only when multiple images */}
        {hasMultiple && !showPlaceholder && (
          <>
            <button
              onClick={prev}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              onClick={next}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            >
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
            {/* Dot indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPhotoIdx(i); setImgFailed(false) }}
                  className={`w-1 h-1 rounded-full transition-all ${i === photoIdx ? 'bg-white w-2' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Replace button — appears on hover */}
        {onReplace && (
          <button
            onClick={() => onReplace(product)}
            disabled={isSwapping}
            className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-[var(--text-muted)] hover:text-white text-xs px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--border-hover)] transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-wait"
          >
            <RefreshCw className={`w-3 h-3 ${isSwapping ? 'animate-spin' : ''}`} />
            Replace
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="p-2 space-y-1.5">
        <div>
          <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-medium leading-none">
            {product.brand}
          </p>
          <p className="text-[var(--text)] text-xs font-medium leading-tight mt-0.5 line-clamp-2">
            {product.name}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[var(--text)] font-semibold text-xs">{formattedPrice}</p>
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-[#E8A94A] text-[#1A0E00] text-[10px] font-semibold px-2 py-1 rounded-md hover:bg-[#f0b85a] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Shop
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
