'use client'

import { useState, useTransition } from 'react'
import { Bot, X } from 'lucide-react'

import { getChatMessagesAction } from '../actions'
import type { ChatMessage } from '../types'
import { ChatWindow } from './ChatWindow'

interface ChatWidgetProps {
  userId: string | null
}

export function ChatWidget({ userId }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!userId) return null

  function handleOpen() {
    setIsOpen(true)
    if (messages === null) {
      startTransition(async () => {
        const result = await getChatMessagesAction()
        setMessages(result.success ? result.data : [])
      })
    }
  }

  return (
    <>
      {/* Кнопка */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed top-16 right-4 md:top-6 md:right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-opacity hover:opacity-90"
          style={{ background: 'var(--apex-primary)', color: '#fff' }}
          aria-label="Открыть ассистента"
        >
          <Bot size={20} />
        </button>
      )}

      {/* Панель */}
      {isOpen && (
        <>
          {/* Backdrop на мобайле */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[420px] flex flex-col shadow-2xl"
            style={{
              background: 'var(--apex-bg)',
              borderLeft: '1px solid var(--apex-border)',
            }}
          >
            {/* Шапка */}
            <div
              className="flex items-center gap-3 px-4 h-14 shrink-0"
              style={{
                background: 'var(--apex-surface)',
                borderBottom: '1px solid var(--apex-border)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--apex-success-bg)' }}
              >
                <Bot size={16} style={{ color: 'var(--apex-primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--apex-text)' }}>
                  Ассистент
                </p>
                <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                  Вопросы о правилах геймификации
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                style={{ color: 'var(--apex-text-muted)' }}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            {/* Контент */}
            {isPending || messages === null ? (
              <div className="flex-1 flex items-center justify-center">
                <div
                  className="w-6 h-6 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: 'var(--apex-border)',
                    borderTopColor: 'var(--apex-primary)',
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0">
                <ChatWindow initialMessages={messages} userId={userId} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
