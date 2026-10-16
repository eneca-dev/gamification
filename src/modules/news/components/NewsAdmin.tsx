'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { saveNews } from '../actions'
import { NEWS_CATEGORIES } from '../types'
import type { NewsItem, NewsInput } from '../types'

const empty: NewsInput = { title: '', body: '', category: 'app_changes', department_code: null, duration_days: 7, published: false }
const fieldStyle = { background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }

function NewsSelect({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    searchRef.current?.focus()
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [open])
  const filtered = options.filter(option => option.label.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')))
  return <div ref={root} className="relative min-w-0 sm:min-w-56">
    <span className="block text-[12px] mb-1" style={{ color: 'var(--apex-text)' }}>{label}</span>
    <button type="button" aria-label={label} aria-expanded={open} aria-haspopup="listbox"
      onClick={() => { setSearch(''); setOpen(!open) }}
      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px]" style={fieldStyle}>
      <span className="truncate">{options.find(option => option.value === value)?.label ?? value}</span>
      <ChevronDown size={15} className="shrink-0" />
    </button>
    {open && <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-56 rounded-xl p-2 shadow-lg"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--apex-text-muted)' }} />
        <input ref={searchRef} type="search" aria-label={`Поиск: ${label.toLowerCase()}`}
          value={search} onChange={event => setSearch(event.target.value)}
          className="w-full rounded-lg py-2 pl-7 pr-2 text-[12px]" style={fieldStyle} placeholder="Поиск" />
      </div>
      <div role="listbox" aria-label={label} className="max-h-56 overflow-y-auto">
        {filtered.map(option => <button key={option.value} type="button" role="option" aria-selected={value === option.value}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12px] hover:opacity-80"
          style={{ background: value === option.value ? 'var(--apex-success-bg)' : 'transparent', color: 'var(--apex-text)' }}
          onClick={() => { onChange(option.value); setOpen(false) }}>
          <span>{option.label}</span>{value === option.value && <Check size={14} className="shrink-0" />}
        </button>)}
        {filtered.length === 0 && <p className="px-3 py-2 text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>Ничего не найдено</p>}
      </div>
    </div>}
  </div>
}

function NewsList({ title, items, onEdit }: { title: string; items: NewsItem[]; onEdit: (item: NewsItem) => void }) {
  return <section className="space-y-2" aria-label={title}>
    <h2 className="text-[14px] font-semibold" style={{ color: 'var(--apex-text)' }}>{title} <span style={{ color: 'var(--apex-text-muted)' }}>({items.length})</span></h2>
    {items.length === 0 && <p className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>Пока нет новостей</p>}
    {items.map(item => <div key={item.id} className="rounded-xl p-3 flex items-center justify-between gap-3"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <div className="min-w-0">
        <p className="font-semibold text-[13px] truncate" style={{ color: 'var(--apex-text)' }}>{item.title}</p>
        <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          {NEWS_CATEGORIES[item.category]} · {item.department_code ?? 'Все отделы'}
          {item.expires_at && ` · До ${new Date(item.expires_at).toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`}
        </p>
      </div>
      <button type="button" onClick={() => onEdit(item)} className="text-[12px] shrink-0" style={{ color: 'var(--apex-primary)' }}>Изменить</button>
    </div>)}
  </section>
}

export function NewsAdmin({ items, departments, now }: { items: NewsItem[]; departments: string[]; now: number }) {
  const [draft, setDraft] = useState<NewsInput>(empty)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const active = items.filter(item => item.published_at && new Date(item.published_at).getTime() <= now && item.expires_at && new Date(item.expires_at).getTime() > now)
  const upcoming = items.filter(item => item.published_at && new Date(item.published_at).getTime() > now)
  const expired = items.filter(item => item.published_at && item.expires_at && new Date(item.expires_at).getTime() <= now)
  const drafts = items.filter(item => !item.published_at)

  function edit(item: NewsItem) {
    const duration = item.published_at && item.expires_at
      ? Math.round((new Date(item.expires_at).getTime() - new Date(item.published_at).getTime()) / 86_400_000) : 7
    setDraft({ id: item.id, title: item.title, body: item.body, category: item.category,
      department_code: item.department_code, duration_days: Math.max(1, duration), published: Boolean(item.published_at) })
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveNews(draft)
      if (!result.success) setError(result.error)
      else { setDraft(empty); window.location.reload() }
    })
  }

  return <div className="space-y-6">
    <section className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <h2 className="font-semibold" style={{ color: 'var(--apex-text)' }}>{draft.id ? 'Редактировать новость' : 'Новая новость'}</h2>
      <label className="block text-[12px]" style={{ color: 'var(--apex-text)' }}>Название
        <input className="block w-full p-2 rounded-lg mt-1" style={fieldStyle} maxLength={160} value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })} />
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--apex-text)' }}>Текст
        <textarea className="block w-full p-2 rounded-lg mt-1" style={fieldStyle} rows={5} maxLength={5000} value={draft.body}
          onChange={e => setDraft({ ...draft, body: e.target.value })} />
      </label>
      <div className="flex flex-wrap gap-3">
        <NewsSelect label="Категория" value={draft.category}
          options={Object.entries(NEWS_CATEGORIES).map(([value, label]) => ({ value, label }))}
          onChange={value => setDraft({ ...draft, category: value as NewsInput['category'] })} />
        <NewsSelect label="Получатели" value={draft.department_code ?? ''}
          options={[{ value: '', label: 'Все отделы' }, ...departments.map(value => ({ value, label: value }))]}
          onChange={value => setDraft({ ...draft, department_code: value || null })} />
        <label className="block text-[12px]" style={{ color: 'var(--apex-text)' }}>Срок показа, дней
          <input type="number" min={1} max={365} step={1} className="block w-36 p-2 rounded-lg mt-1 text-[13px]" style={fieldStyle}
            value={draft.duration_days} onChange={e => setDraft({ ...draft, duration_days: Number(e.target.value) })} />
        </label>
      </div>
      <p className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>Новость исчезнет с главной через указанное число дней после публикации и останется в истории.</p>
      <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--apex-text)' }}>
        <input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} />Опубликовано
      </label>
      {error && <p role="alert" style={{ color: 'var(--apex-danger)' }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: 'var(--apex-primary)' }}>Сохранить</button>
        {draft.id && <button type="button" onClick={() => setDraft(empty)} className="px-4 py-2 rounded-lg"
          style={{ color: 'var(--apex-text)' }}>Отмена</button>}
      </div>
    </section>
    <NewsList title="Сейчас показываются" items={active} onEdit={edit} />
    {upcoming.length > 0 && <NewsList title="Ожидают публикации" items={upcoming} onEdit={edit} />}
    <NewsList title="Черновики" items={drafts} onEdit={edit} />
    <NewsList title="История новостей" items={expired} onEdit={edit} />
  </div>
}
