'use client'

import { useMemo, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { useHelpSearch } from './HelpSearchContext'

interface HelpContentProps {
  title: string
  content: string
  updatedAt: string
}

/** Разбивает текст на фрагменты, оборачивая совпадения в <mark> */
function highlightText(text: string, query: string): ReactNode {
  if (!query || query.length < 2) return text

  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const parts: ReactNode[] = []
  let lastIdx = 0
  let idx = lower.indexOf(q)

  while (idx !== -1) {
    if (idx > lastIdx) {
      parts.push(text.slice(lastIdx, idx))
    }
    parts.push(
      <mark
        key={idx}
        className="rounded px-0.5"
        style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
    )
    lastIdx = idx + query.length
    idx = lower.indexOf(q, lastIdx)
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return parts.length > 0 ? <>{parts}</> : text
}

export function HelpContent({ title, content, updatedAt }: HelpContentProps) {
  const { query } = useHelpSearch()

  const formattedDate = new Date(updatedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Компоненты react-markdown с подсветкой совпадений
  const components = useMemo<Components>(() => {
    if (!query || query.length < 2) return {}

    function wrapChildren(children: ReactNode): ReactNode {
      if (typeof children === 'string') return highlightText(children, query)
      if (Array.isArray(children)) return children.map((c, i) =>
        typeof c === 'string' ? <span key={i}>{highlightText(c, query)}</span> : c
      )
      return children
    }

    return {
      p: ({ children }) => <p>{wrapChildren(children)}</p>,
      li: ({ children }) => <li>{wrapChildren(children)}</li>,
      td: ({ children }) => <td>{wrapChildren(children)}</td>,
      th: ({ children }) => <th>{wrapChildren(children)}</th>,
      strong: ({ children }) => <strong>{wrapChildren(children)}</strong>,
      h2: ({ children }) => <h2>{wrapChildren(children)}</h2>,
      h3: ({ children }) => <h3>{wrapChildren(children)}</h3>,
    }
  }, [query])

  return (
    <article>
      <h1
        className="text-xl font-extrabold mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        {query && query.length >= 2 ? highlightText(title, query) : title}
      </h1>
      <div
        className="text-[11px] font-medium mb-6"
        style={{ color: 'var(--text-muted)' }}
      >
        Обновлено {formattedDate}
      </div>

      <div className="help-content">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </Markdown>
      </div>
    </article>
  )
}
