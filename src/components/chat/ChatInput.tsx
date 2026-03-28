'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Send, Camera, X } from 'lucide-react'
import { ImageUpload } from '@/components/upload/ImageUpload'

interface ChatInputProps {
  onSend: (message: string, imageBase64?: string, imageMimeType?: string, imagePreview?: string) => void
  isLoading: boolean
  placeholder?: string
}

export function ChatInput({ onSend, isLoading, placeholder }: ChatInputProps) {
  const [text, setText] = useState('')
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMimeType, setImageMimeType] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed && !imageBase64) return
    if (isLoading) return

    onSend(trimmed, imageBase64 ?? undefined, imageMimeType ?? undefined, imagePreview ?? undefined)
    setText('')
    setImageBase64(null)
    setImageMimeType(null)
    setImagePreview(null)
    setShowImageUpload(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImageSelect = (base64: string, mimeType: string, preview: string) => {
    setImageBase64(base64)
    setImageMimeType(mimeType)
    setImagePreview(preview)
    setShowImageUpload(false)
  }

  return (
    <div className="space-y-3">
      {/* Image preview */}
      {imagePreview && (
        <div className="flex items-start gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Selected"
              className="h-16 w-16 object-cover rounded-xl border border-white/10"
            />
            <button
              onClick={() => {
                setImageBase64(null)
                setImageMimeType(null)
                setImagePreview(null)
              }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-white/20 rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
          <p className="text-white/40 text-xs mt-1">Image ready · add a message or send as-is</p>
        </div>
      )}

      {/* Image upload dropzone */}
      {showImageUpload && !imagePreview && (
        <ImageUpload onImageSelect={handleImageSelect} />
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 bg-zinc-900 border border-white/10 rounded-2xl px-3 py-2.5">
        <button
          onClick={() => setShowImageUpload(!showImageUpload)}
          title="Upload a photo of a look to style"
          className={`
            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors
            ${showImageUpload ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}
          `}
        >
          <Camera className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Describe your style or ask for an outfit...'}
          rows={1}
          className="flex-1 bg-transparent text-white text-sm placeholder-white/30 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
          style={{ scrollbarWidth: 'none' }}
        />

        <button
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && !imageBase64)}
          className={`
            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all
            ${isLoading || (!text.trim() && !imageBase64)
              ? 'text-white/20 cursor-not-allowed'
              : 'bg-white text-black hover:bg-white/90'
            }
          `}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
