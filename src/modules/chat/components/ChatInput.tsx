'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
}

const MAX_HEIGHT = 120

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isPending, setIsPending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Фокус при открытии и после ответа ассистента
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  // Авторазмер textarea
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.overflowY = 'hidden'
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px'
    if (el.scrollHeight > MAX_HEIGHT) el.style.overflowY = 'auto'
  }, [value])

  async function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isPending || disabled) return

    setValue('')
    setIsPending(true)
    try {
      await onSend(trimmed)
    } finally {
      setIsPending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isDisabled = isPending || disabled

  return (
    <div
      className="flex items-end gap-2 p-3 rounded-2xl"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Задайте вопрос о системе геймификации..."
        rows={1}
        disabled={isDisabled}
        className="flex-1 resize-none bg-transparent outline-none text-[14px] leading-relaxed placeholder:text-[var(--apex-text-muted)] text-[var(--apex-text)] disabled:opacity-50"
        style={{ scrollbarWidth: 'thin' }}
      />
      <button
        onClick={handleSubmit}
        disabled={isDisabled || !value.trim()}
        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'var(--apex-primary)', color: '#fff' }}
      >
        <Send size={15} />
      </button>
    </div>
  )
}
