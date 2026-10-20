'use client'

import { Play } from 'lucide-react'

import { hasVideo, mediaPoster } from '../media'
import type { ProductMediaItem } from '../types'

interface MediaStackPreviewProps {
  media: ProductMediaItem[]
  /** Обложка (product.image_url) — используется как главное фото, если задано. */
  imageUrl: string | null
  emoji: string | null
  name: string
  /** sm = 40×40 (таблица), lg = h-36 (grid). */
  size: 'sm' | 'lg'
}

export function MediaStackPreview({ media, imageUrl, emoji, name, size }: MediaStackPreviewProps) {
  const cover = imageUrl ?? (media[0] ? mediaPoster(media[0]) : null)
  const extraCount = Math.max(media.length - 1, 0)
  const videoInside = hasVideo(media)
  const second = media[1] ? mediaPoster(media[1]) : null
  const third = media[2] ? mediaPoster(media[2]) : null
  const playSize = size === 'lg' ? 14 : 10

  // --- lg: fan-stack ---
  if (size === 'lg') {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {third && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={third}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              transform: 'rotate(-5deg) translateX(-10px) scale(0.9)',
              opacity: 0.45,
              zIndex: 1,
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08))',
            }}
          />
        )}
        {second && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={second}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              transform: 'rotate(4deg) translateX(8px) scale(0.93)',
              opacity: 0.7,
              zIndex: 2,
              filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.1))',
            }}
          />
        )}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={name}
            className="relative w-full h-full object-contain"
            style={{ zIndex: 3 }}
          />
        ) : (
          <span className="relative text-5xl" style={{ zIndex: 3 }}>
            {emoji || <span style={{ color: '#ccc' }}>?</span>}
          </span>
        )}
        {videoInside && (
          <div
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0, 0, 0, 0.55)', zIndex: 10 }}
            aria-label="Товар содержит видео"
          >
            <Play size={playSize} fill="white" color="white" />
          </div>
        )}
      </div>
    )
  }

  // --- sm: обложка + бейдж +N (правый низ) + Play (правый верх), бейджи вне рамки картинки ---
  return (
    <div className="relative w-full h-full">
      <div className="w-full h-full overflow-hidden rounded-lg">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={name} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[16px] rounded-lg">
            {emoji || <span style={{ color: '#ccc' }}>?</span>}
          </div>
        )}
      </div>
      {videoInside && (
        <div
          className="absolute w-3.5 h-3.5 rounded-full flex items-center justify-center"
          style={{ top: -4, right: -4, background: 'rgba(0, 0, 0, 0.75)', zIndex: 10 }}
          aria-label="Содержит видео"
        >
          <Play size={7} fill="white" color="white" />
        </div>
      )}
      {extraCount > 0 && (
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            bottom: -4,
            right: -4,
            minWidth: 16,
            height: 14,
            padding: '0 4px',
            background: 'var(--apex-primary)',
            color: 'white',
            fontSize: 9,
            fontWeight: 700,
            zIndex: 10,
          }}
          aria-label={`Ещё ${extraCount} медиа`}
        >
          +{extraCount}
        </div>
      )}
    </div>
  )
}
