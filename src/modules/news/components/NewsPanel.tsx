'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { NEWS_CATEGORIES } from '../types'
import type { NewsItem } from '../types'

function previewText(body: string): string {
  if (body.length <= 300) return body
  const head = body.slice(0, 301)
  const wordEnd = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\n'))
  return body.slice(0, wordEnd > 0 ? wordEnd : 300).trimEnd()
}

function NewsCard({ item }: { item: NewsItem }) {
  const [expanded, setExpanded] = useState(false)
  const preview = previewText(item.body)
  const hasMore = preview.length < item.body.length
  const isBug = item.category === 'bug'

  return <article className="rounded-xl px-3 py-2.5"
    style={{ background: isBug ? 'var(--apex-error-bg)' : 'var(--apex-bg)',
      border: isBug ? '1px solid var(--apex-danger)' : '1px solid var(--apex-border)' }}>
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 max-w-[40%] truncate text-[11px] font-bold sm:max-w-none"
        style={{ color: isBug ? 'var(--apex-danger)' : 'var(--apex-primary)' }}>
        {NEWS_CATEGORIES[item.category]}
      </span>
      <h3 className="min-w-0 flex-1 truncate text-[11px] font-bold" title={item.title}
        style={{ color: 'var(--apex-text)' }}>{item.title}</h3>
      <time className="shrink-0 text-[11px]" style={{ color: 'var(--apex-text-muted)' }} dateTime={item.published_at ?? ''}>
        {item.published_at ? new Date(item.published_at).toLocaleDateString('ru-RU') : ''}
      </time>
    </div>
    <p className="mt-1 text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--apex-text-secondary)' }}>
      {expanded ? item.body : preview}{hasMore && <>{expanded ? ' ' : '… '}
        <button type="button" aria-label={expanded ? `Свернуть новость «${item.title}»` : `Раскрыть новость «${item.title}»`}
          aria-expanded={expanded} onClick={() => setExpanded(!expanded)}
          className="inline-flex align-middle rounded focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: 'var(--apex-primary)' }}>
          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </>}
    </p>
  </article>
}

export function NewsPanel({ items }: { items: NewsItem[] }) {
  return <section aria-labelledby="news-title" className="rounded-2xl p-4"
    style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
    <h2 id="news-title" className="text-[15px] font-bold mb-2" style={{ color: 'var(--apex-text)' }}>Новости</h2>
    <div className="max-h-72 overflow-y-auto space-y-2 pr-1" tabIndex={0} aria-label="Список новостей">
      {items.map(item => <NewsCard key={item.id} item={item} />)}
    </div>
  </section>
}
