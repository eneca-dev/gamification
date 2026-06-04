'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ImageLightboxProps {
  url: string
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ url, alt = 'Изображение', onClose }: ImageLightboxProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'var(--apex-overlay)' }}
      onClick={onClose}
    >
      <div className="relative flex items-center justify-center">
        <img
          src={url}
          alt={alt}
          className="rounded-xl max-w-full max-h-[85vh] object-contain"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.4)', maxWidth: '90vw' }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
        >
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body
  )
}
