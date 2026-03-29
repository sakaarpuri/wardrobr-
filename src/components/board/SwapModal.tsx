'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Product } from '@/lib/types'
import { X, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SwapModalProps {
  alternatives: Product[]
  actionLabel?: string
  onSelect: (product: Product) => void
  onClose: () => void
}

export function SwapModal({ alternatives, actionLabel, onSelect, onClose }: SwapModalProps) {
  const [failedImages, setFailedImages] = useState<Record<string, true>>({})

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl p-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">{actionLabel ? `Choose a ${actionLabel.toLowerCase()} option` : 'Choose a replacement'}</h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {alternatives.map((product) => (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                className="group text-left bg-zinc-800 hover:bg-zinc-700 border border-white/5 hover:border-white/20 rounded-xl overflow-hidden transition-all"
              >
                <div className="aspect-[3/4] bg-zinc-700 overflow-hidden">
                  {product.imageUrl && !failedImages[product.id] ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={240}
                      height={320}
                      sizes="(max-width: 640px) 28vw, 180px"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={() => setFailedImages((current) => ({ ...current, [product.id]: true }))}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-white/40 text-xs uppercase tracking-wide truncate">
                    {product.brand}
                  </p>
                  <p className="text-white text-xs font-medium mt-0.5 line-clamp-2 leading-snug">
                    {product.name}
                  </p>
                  <p className="text-white font-semibold text-xs mt-1">
                    {new Intl.NumberFormat('en-GB', {
                      style: 'currency',
                      currency: product.currency ?? 'GBP',
                    }).format(product.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <a
              href={alternatives[0]?.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors"
            >
              View all at retailer
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
