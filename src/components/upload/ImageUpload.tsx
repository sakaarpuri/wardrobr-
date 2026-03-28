'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, ImagePlus, X } from 'lucide-react'

interface ImageUploadProps {
  onImageSelect: (base64: string, mimeType: string, preview: string) => void
  onClear?: () => void
  selectedImage?: string | null
}

export function ImageUpload({ onImageSelect, onClear, selectedImage }: ImageUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false)

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        const base64 = result.split(',')[1]
        onImageSelect(base64, file.type, result)
      }
      reader.readAsDataURL(file)
    },
    [onImageSelect]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  })

  if (selectedImage) {
    return (
      <div className="relative inline-block">
        <img
          src={selectedImage}
          alt="Selected outfit"
          className="max-h-48 max-w-xs rounded-xl object-cover border border-white/10"
        />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute -top-2 -right-2 w-6 h-6 bg-zinc-800 border border-white/20 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200
        ${isDragActive
          ? 'border-white/60 bg-white/5'
          : 'border-white/20 hover:border-white/40 hover:bg-white/5'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <ImagePlus className="w-6 h-6 text-white/60" />
        </div>
        <div>
          <p className="text-white font-medium text-sm">
            {isDragActive ? 'Drop it here' : 'Upload a look'}
          </p>
          <p className="text-white/40 text-xs mt-1">
            Drag & drop or click · JPG, PNG, WebP · Max 10MB
          </p>
        </div>
      </div>
    </div>
  )
}
