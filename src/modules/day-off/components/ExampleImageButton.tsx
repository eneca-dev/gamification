'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { ImageLightbox } from '@/components/ImageLightbox'

export function ExampleImageButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors"
        style={{ color: 'var(--apex-primary)' }}
      >
        <Eye size={13} />
        Посмотреть пример скриншота
      </button>

      {open && (
        <ImageLightbox
          url="/day-off-example.jpg"
          alt="Пример скриншота согласования"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
