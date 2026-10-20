'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { mediaPoster, youTubeEmbedSrc } from '../media'
import type { ProductMediaItem } from '../types'

interface ProductMediaGalleryProps {
  media: ProductMediaItem[]
  title: string
  initialIndex?: number
  onClose: () => void
}

export function ProductMediaGallery({ media, title, initialIndex = 0, onClose }: ProductMediaGalleryProps) {
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(media.length - 1, 0)))
  // Facade: тяжёлый ресурс (iframe YouTube / <video>) монтируется только после клика по постеру
  const [videoPlaying, setVideoPlaying] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const total = media.length
  const current = media[index]

  function go(delta: number) {
    if (total < 2) return
    setIndex((i) => (i + delta + total) % total)
    setVideoPlaying(false)
  }

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (total < 2) return
        const delta = e.key === 'ArrowLeft' ? -1 : 1
        setIndex((i) => (i + delta + total) % total)
        setVideoPlaying(false)
      } else if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), iframe, video[controls]')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      previousFocus?.focus()
    }
  }, [total, onClose])

  if (typeof window === 'undefined' || !current) return null

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Медиа товара ${title}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      style={{ background: 'rgba(0, 0, 0, 0.75)' }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
        aria-label="Закрыть"
      >
        <X size={18} />
      </button>

      <div
        className="relative w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Основная зона 16:9 — белая подложка, чтобы картинки с прозрачным фоном не "съедались" чёрным */}
        <div
          className="relative w-full rounded-xl overflow-hidden"
          style={{ aspectRatio: '16/9', background: 'white' }}
        >
          {current.kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`image-${index}`}
              src={current.url}
              alt={title}
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}

          {(current.kind === 'youtube' || current.kind === 'video') && !videoPlaying && (
            <button
              onClick={() => setVideoPlaying(true)}
              className="absolute inset-0 w-full h-full group cursor-pointer"
              aria-label={`Воспроизвести: ${title}`}
            >
              {mediaPoster(current) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaPoster(current)!}
                  alt={title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-black" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg">
                  <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </button>
          )}

          {current.kind === 'youtube' && videoPlaying && (
            <iframe
              key={`yt-${index}`}
              src={youTubeEmbedSrc(current.video_id)}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )}

          {current.kind === 'video' && videoPlaying && (
            <video
              key={`video-${index}`}
              src={current.url}
              poster={current.poster_url ?? undefined}
              controls
              autoPlay
              preload="metadata"
              className="absolute inset-0 w-full h-full"
            />
          )}

          {/* Стрелки — на белой подложке читаемы в тёмном варианте */}
          {total > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(0, 0, 0, 0.5)', color: 'white' }}
                aria-label="Предыдущее"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(0, 0, 0, 0.5)', color: 'white' }}
                aria-label="Следующее"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {/* Точки-пагинация — на чёрном backdrop → белые */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); setVideoPlaying(false) }}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 16 : 8,
                  height: 8,
                  background: i === index ? 'white' : 'rgba(255, 255, 255, 0.4)',
                }}
                aria-label={`Перейти к ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
