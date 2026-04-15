'use client'

import { useRef } from 'react'
import { Search, X } from 'lucide-react'

import { useHelpSearch } from './HelpSearchContext'

export function HelpSearchInput() {
  const { query, setQuery } = useHelpSearch()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      data-onboarding="help-search"
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <Search size={15} style={{ color: 'var(--text-muted)' }} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Поиск по справке…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 bg-transparent text-[13px] outline-none"
        style={{ color: 'var(--text-primary)' }}
      />
      {query && (
        <button
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
          className="p-0.5 rounded hover:opacity-70"
        >
          <X size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      )}
    </div>
  )
}
