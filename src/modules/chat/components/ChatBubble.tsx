import type { ChatMessage } from '../types'

interface ChatBubbleProps {
  message: ChatMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
          isUser ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
        style={
          isUser
            ? { background: 'var(--apex-primary)', color: '#fff' }
            : { background: 'var(--apex-surface)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)' }
        }
      >
        {message.content}
      </div>
    </div>
  )
}
