'use client'

import { useState } from 'react'
import { MessageCirclePlus } from 'lucide-react'

import { FeedbackModal } from './FeedbackModal'

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 pl-4 pr-5 h-11 rounded-full shadow-lg transition-colors"
        style={{
          background: 'var(--apex-primary)',
          color: '#fff',
        }}
        aria-label="Обратная связь"
      >
        <MessageCirclePlus size={18} />
        <span className="text-sm font-medium">Обратная связь</span>
      </button>

      {isOpen && <FeedbackModal onClose={() => setIsOpen(false)} />}
    </>
  )
}
