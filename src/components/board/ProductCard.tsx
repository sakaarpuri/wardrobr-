'use client'

import { useState } from 'react'
import { Product } from '@/lib/types'
import { ExternalLink, RefreshCw } from 'lucide-react'

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
  const formattedPrice = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: product.currency ?? 'GBP',
  }).format(product.price)

  const showPlaceholder = !product.imageUrl || imgFailed

  return (
    <div className="group bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 hover:border-white/15 transition-all duration-300">
      {/* Product Image */}
      <div className="aspect-[3/4] bg-zinc-800 overflow-hidden relative">
        {showPlaceholder ? (
          <ImagePlaceholder category={product.category} />
        ) : (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgFailed(true)}
          />
        )}

        {/* Replace button — appears on hover */}
        {onReplace && (
          <button
            onClick={() => onReplace(product)}
            disabled={isSwapping}
            className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white/70 hover:text-white text-xs px-2 py-1 rounded-lg border border-white/10 hover:border-white/30 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-wait"
          >
            <RefreshCw className={`w-3 h-3 ${isSwapping ? 'animate-spin' : ''}`} />
            Replace
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="p-2 space-y-1.5">
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium leading-none">
            {product.brand}
          </p>
          <p className="text-white text-xs font-medium leading-tight mt-0.5 line-clamp-2">
            {product.name}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-white font-semibold text-xs">{formattedPrice}</p>
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-white text-black text-[10px] font-semibold px-2 py-1 rounded-md hover:bg-white/90 transition-colors"
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
