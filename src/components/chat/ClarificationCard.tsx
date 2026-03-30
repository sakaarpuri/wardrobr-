'use client'

import { ClarificationPrompt } from '@/lib/types'
import { Loader2 } from 'lucide-react'

interface ClarificationCardProps {
  clarification: ClarificationPrompt
  onSelect: (groupId: string, optionId: string) => void
}

export function ClarificationCard({ clarification, onSelect }: ClarificationCardProps) {
  return (
    <div className="space-y-4">
      {clarification.groups.map((group) => (
        <div key={group.id} className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
              {group.label}
            </p>
            {group.selectedOptionId && (
              <span className="text-[11px] text-[var(--text-faint)]">Selected</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const isSelected = group.selectedOptionId === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={clarification.isSubmitting}
                  onClick={() => onSelect(group.id, option.id)}
                  className={`rounded-full border px-3.5 py-2.5 text-left text-sm transition-all sm:px-3 sm:py-2 sm:text-xs ${
                    isSelected
                      ? 'border-[#E8A94A]/65 bg-[#E8A94A]/10 text-[#E8A94A]'
                      : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[#E8A94A]/35 hover:text-[var(--text)]'
                  } ${clarification.isSubmitting ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <span className="block font-medium">{option.label}</span>
                  {option.helper && (
                    <span className={`mt-1 block text-xs leading-relaxed sm:text-[11px] ${isSelected ? 'text-[#E8A94A]/80' : 'text-[var(--text-faint)]'}`}>
                      {option.helper}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {clarification.isSubmitting && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Got it. Working on that...
        </div>
      )}
    </div>
  )
}
