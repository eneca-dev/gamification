import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { ChatMessage } from '../types'

interface ChatBubbleProps {
  message: ChatMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        data-role={message.role}
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed break-words ${
          isUser ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
        style={
          isUser
            ? { background: 'var(--apex-primary)', color: '#fff' }
            : { background: 'var(--apex-surface)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)' }
        }
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              a: ({ href, children }) => {
                const isInternal = href?.startsWith('/')
                return (
                  <a
                    href={href}
                    className="underline underline-offset-2 hover:opacity-80"
                    {...(!isInternal && { target: '_blank', rel: 'noopener noreferrer' })}
                  >
                    {children}
                  </a>
                )
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}
