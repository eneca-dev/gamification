'use client'

import { MessageCirclePlus } from 'lucide-react'

export function FeedbackButton() {
  return (
    <button
      onClick={() => window.open('/feedback', '_blank')}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 pl-4 pr-5 h-11 rounded-full shadow-lg transition-all hover:scale-[1.01] hover:shadow-xl"
      style={{
        background: 'var(--apex-primary)',
        color: '#fff',
      }}
      aria-label="Обратная связь"
    >
      <MessageCirclePlus size={18} />
      <span className="text-sm font-medium">Обратная связь</span>
    </button>
  )
}
