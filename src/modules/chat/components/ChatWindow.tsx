'use client'

import { useEffect, useRef, useState } from 'react'

import { createSupabaseBrowserClient } from '@/config/supabase.client'

import { sendMessage } from '../actions'
import type { ChatMessage } from '../types'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'

interface ChatWindowProps {
  initialMessages: ChatMessage[]
  userId: string
}

export function ChatWindow({ initialMessages, userId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isWaiting, setIsWaiting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isWaiting])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (msg.role === 'assistant') setIsWaiting(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function handleSend(content: string) {
    setIsWaiting(true)
    const result = await sendMessage({ content })
    if (!result.success) setIsWaiting(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isWaiting && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <div className="text-4xl">🤖</div>
            <p className="text-[14px] font-medium" style={{ color: 'var(--apex-text)' }}>
              Ассистент системы геймификации
            </p>
            <p className="text-[12px] text-center max-w-xs" style={{ color: 'var(--apex-text-muted)' }}>
              Задайте вопрос о правилах и механике — как работают стрики, щиты, достижения и другое
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isWaiting && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Инпут */}
      <div className="px-4 pb-4 pt-2">
        <ChatInput onSend={handleSend} disabled={isWaiting} />
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{
              background: 'var(--apex-text-muted)',
              animationDelay: `${i * 150}ms`,
              animationDuration: '1s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
