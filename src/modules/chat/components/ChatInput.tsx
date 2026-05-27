'use client'

import { useRef, useState } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isPending, setIsPending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isPending || disabled) return

    setValue('')
    setIsPending(true)
    try {
      await onSend(trimmed)
    } finally {
      setIsPending(false)
      textareaRef.current?.focus()
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
        className="flex-1 resize-none bg-transparent outline-none text-[14px] leading-relaxed placeholder:text-[var(--apex-text-muted)] text-[var(--apex-text)] max-h-32 overflow-y-auto disabled:opacity-50"
        style={{ scrollbarWidth: 'none' }}
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
