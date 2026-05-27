'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot } from 'lucide-react'

export function ChatFloatButton() {
  const pathname = usePathname()
  if (pathname === '/chat') return null

  return (
    <Link
      href="/chat"
      className="fixed top-16 right-4 md:top-6 md:right-6 z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors"
      style={{ background: 'var(--apex-primary)', color: '#fff' }}
      title="Ассистент"
      aria-label="Открыть ассистента"
    >
      <Bot size={20} />
    </Link>
  )
}
