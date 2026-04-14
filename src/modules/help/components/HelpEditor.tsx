'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Eye, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { updateHelpArticle, createHelpArticle, deleteHelpArticle } from '../actions'

interface HelpEditorProps {
  article: {
    slug: string
    title: string
    content: string
    folder: string
    folder_label: string
    sort_order: number
    is_published: boolean
  } | null
  isNew: boolean
}

export function HelpEditor({ article, isNew }: HelpEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [slug, setSlug] = useState(article?.slug ?? '')
  const [title, setTitle] = useState(article?.title ?? '')
  const [content, setContent] = useState(article?.content ?? '')
  const [folder, setFolder] = useState(article?.folder ?? 'general')
  const [folderLabel, setFolderLabel] = useState(article?.folder_label ?? 'Общее')
  const [sortOrder, setSortOrder] = useState(article?.sort_order ?? 0)
  const [isPublished, setIsPublished] = useState(article?.is_published ?? true)

  const FOLDERS = [
    { value: 'general', label: 'Общее' },
    { value: 'ws', label: 'Worksection' },
    { value: 'revit', label: 'Автоматизация' },
    { value: 'shields', label: 'Вторая жизнь' },
    { value: 'gratitudes', label: 'Благодарности' },
    { value: 'achievements', label: 'Достижения' },
    { value: 'store', label: 'Магазин' },
    { value: 'faq', label: 'Частые вопросы' },
  ]

  function handleFolderChange(value: string) {
    setFolder(value)
    const found = FOLDERS.find((f) => f.value === value)
    if (found) setFolderLabel(found.label)
  }

  function handleSave() {
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const input = {
        slug,
        title,
        content,
        folder,
        folder_label: folderLabel,
        sort_order: sortOrder,
        is_published: isPublished,
      }

      const result = isNew
        ? await createHelpArticle(input)
        : await updateHelpArticle(input)

      if (!result.success) {
        setError(result.error)
      } else {
        setSuccess(true)
        if (isNew) {
          router.push('/admin/help')
        }
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  function handleDelete() {
    if (!confirm('Удалить статью? Это действие нельзя отменить.')) return

    startTransition(async () => {
      const result = await deleteHelpArticle(slug)
      if (!result.success) {
        setError(result.error)
      } else {
        router.push('/admin/help')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/help"
          className="flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={15} />
          Назад к списку
        </Link>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
              style={{
                color: 'var(--apex-danger)',
                border: '1px solid var(--border)',
                background: 'var(--surface-elevated)',
              }}
            >
              <Trash2 size={13} />
              Удалить
            </button>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
            style={{
              background: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {showPreview ? <Pencil size={13} /> : <Eye size={13} />}
            {showPreview ? 'Редактор' : 'Предпросмотр'}
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !slug || !title}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--apex-primary)' }}
          >
            <Save size={13} />
            {isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ background: 'var(--apex-danger)', color: 'white' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
          Сохранено
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Slug (URL)
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!isNew}
            className="w-full px-3 py-2 rounded-xl text-[13px] outline-none disabled:opacity-60"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            placeholder="my-article"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Заголовок
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            placeholder="Название статьи"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Папка
          </label>
          <select
            value={folder}
            onChange={(e) => handleFolderChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {FOLDERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Порядок
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Опубликована
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Editor / Preview */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        {showPreview ? (
          <div className="p-6 help-content" style={{ background: 'var(--surface-elevated)' }}>
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[500px] p-4 text-[13px] font-mono outline-none resize-y"
            style={{
              background: 'var(--surface-elevated)',
              color: 'var(--text-primary)',
              lineHeight: 1.6,
            }}
            placeholder="Markdown контент статьи…"
          />
        )}
      </div>
    </div>
  )
}
