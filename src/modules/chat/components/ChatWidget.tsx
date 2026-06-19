'use client'

import { useState, useTransition } from 'react'
import { Bot, Trash2, X } from 'lucide-react'

import { checkChatAvailability, clearMessages, getChatMessagesAction } from '../actions'
import type { ChatMessage } from '../types'
import { ChatWindow } from './ChatWindow'

interface ChatWidgetProps {
  userId: string | null
}

export function ChatWidget({ userId }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [clearKey, setClearKey] = useState(0)
  const [hasMessages, setHasMessages] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!userId) return null

  async function handleClear() {
    setMessages([])
    setClearKey((k) => k + 1)
    await clearMessages()
  }

  function handleOpen() {
    setIsOpen(true)
    if (messages === null) {
      startTransition(async () => {
        const [available, result] = await Promise.all([
          checkChatAvailability(),
          getChatMessagesAction(),
        ])
        setIsAvailable(available)
        setMessages(result.success ? result.data : [])
      })
    }
  }

  return (
    <>
      {/* Кнопка */}
      {!isOpen && (
        <div className="fixed top-16 right-4 md:top-6 md:right-6 z-50 group">
          <button
            onClick={handleOpen}
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            style={{ background: 'var(--apex-primary)', color: '#fff' }}
            aria-label="Открыть ассистента"
          >
            <Bot size={20} />
          </button>
          <div
            className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-[12px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md"
            style={{ background: 'var(--apex-surface)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)' }}
          >
            Ассистент геймификации
          </div>
        </div>
      )}

      {/* Backdrop на мобайле */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Панель — всегда смонтирована, скрыта через display когда закрыта */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[420px] flex flex-col shadow-2xl"
        style={{
          display: isOpen ? 'flex' : 'none',
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
          {hasMessages && (
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
              style={{ color: 'var(--apex-text-muted)' }}
              aria-label="Очистить чат"
              title="Очистить чат"
            >
              <Trash2 size={16} />
            </button>
          )}
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
        ) : isAvailable === false ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-4xl">🛠️</div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--apex-text)' }}>
              Ассистент на техническом перерыве
            </p>
            <p className="text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
              Сервис временно недоступен. Скоро вернёмся — попробуйте позже.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ChatWindow
              key={clearKey}
              initialMessages={messages}
              userId={userId}
              onHasMessages={setHasMessages}
            />
          </div>
        )}
      </div>
    </>
  )
}
