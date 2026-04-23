'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Save, Eye, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

import { updateHelpArticle, createHelpArticle, deleteHelpArticle } from '../actions'
import { SelectionToolbar } from './SelectionToolbar'
import type { HelpVariableMeta } from '../types'

interface HelpEditorProps {
  article: {
    slug: string
    title: string
    content: string
    folder: string
    folder_label: string
    is_published: boolean
  } | null
  isNew: boolean
  variables: HelpVariableMeta[]
}

// Группировка переменных по префиксу ключа — автоматически отражает новые ключи из БД
const KEY_PREFIX_TO_GROUP: Record<string, string> = {
  green: 'Worksection',
  red: 'Worksection',
  wrong: 'Worksection',
  ws: 'Стрики WS',
  revit: 'Revit',
  deadline: 'Бюджет задач',
  budget: 'Бюджет задач',
  master: 'Мастер планирования',
  ach: 'Достижения',
  team: 'Достижения',
  gratitude: 'Благодарности',
  shield: 'Щиты стрика',
}

function groupVariables(vars: HelpVariableMeta[]): { label: string; vars: HelpVariableMeta[] }[] {
  const map = new Map<string, HelpVariableMeta[]>()
  for (const v of vars) {
    const prefix = v.key.split('_')[0]
    const group = KEY_PREFIX_TO_GROUP[prefix] ?? 'Прочее'
    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push(v)
  }
  return [...map.entries()].map(([label, vars]) => ({ label, vars }))
}

function applyVariables(content: string, vars: HelpVariableMeta[]): string {
  const map = Object.fromEntries(vars.map((v) => [v.key, v.value]))
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => map[key] ?? match)
}

interface VarMenuState {
  x: number
  y: number
}

export function HelpEditor({ article, isNew, variables }: HelpEditorProps) {
  const varGroups = groupVariables(variables)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [varMenu, setVarMenu] = useState<VarMenuState | null>(null)

  const [slug, setSlug] = useState(article?.slug ?? '')
  const [title, setTitle] = useState(article?.title ?? '')
  const [content, setContent] = useState(article?.content ?? '')
  const [folder, setFolder] = useState(article?.folder ?? 'general')
  const [folderLabel, setFolderLabel] = useState(article?.folder_label ?? 'Общее')
  const [isPublished, setIsPublished] = useState(article?.is_published ?? true)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // закрытие меню по клику вне или по Escape
  useEffect(() => {
    if (!varMenu) return

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVarMenu(null)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setVarMenu(null)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [varMenu])

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

  function handleContextMenu(e: React.MouseEvent<HTMLTextAreaElement>) {
    e.preventDefault()
    setVarMenu({ x: e.clientX, y: e.clientY })
  }

  function insertVariable(key: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const token = `{{${key}}}`
    const next = content.slice(0, start) + token + content.slice(end)
    setContent(next)
    setVarMenu(null)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + token.length, start + token.length)
    })
  }

  function handleSave() {
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const input = { slug, title, content, folder, folder_label: folderLabel, is_published: isPublished }
      const result = isNew ? await createHelpArticle(input) : await updateHelpArticle(input)

      if (!result.success) {
        setError(result.error)
      } else {
        setSuccess(true)
        if (isNew) router.push('/admin/help')
        timeoutRef.current = setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteHelpArticle(slug)
      if (!result.success) {
        setError(result.error)
      } else {
        router.push('/admin/help')
      }
    })
    setShowDeleteConfirm(false)
  }

  // меню открывается влево от курсора если курсор в правой половине экрана
  function getMenuStyle(x: number, y: number): React.CSSProperties {
    const menuW = 260
    const menuH = 480
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = x + menuW > vw ? x - menuW : x
    const top = y + menuH > vh ? Math.max(8, vh - menuH - 8) : y
    return {
      position: 'fixed',
      top,
      left: Math.max(8, left),
      zIndex: 9999,
      width: menuW,
    }
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
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
              style={{ color: 'var(--apex-danger)', border: '1px solid var(--border)', background: 'var(--surface-elevated)' }}
            >
              <Trash2 size={13} />
              Удалить
            </button>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
            style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
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
        {isNew && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Slug (URL)
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              placeholder="my-article"
            />
          </div>
        )}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Заголовок
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
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
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {FOLDERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
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

      {/* Подсказки */}
      <div className="space-y-1">
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          В тексте можно использовать переменные — значения из базы данных, которые подставляются автоматически
          (количество монет, пороги, цены). Чтобы вставить переменную, поставьте курсор в нужное место
          и нажмите правую кнопку мыши в поле редактора.
        </p>
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Чтобы сделать текст <strong style={{ color: 'var(--text-secondary)' }}>жирным</strong> или{' '}
          <span style={{ color: '#1B6B58', fontWeight: 600 }}>цветным</span> — выделите нужный фрагмент,
          и над ним появится плашка с кнопками <strong style={{ color: 'var(--text-secondary)' }}>Ж</strong> (жирный)
          и палитрой цветов.
        </p>
      </div>

      {/* Editor / Preview */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {showPreview ? (
          <div className="p-6 help-content" style={{ background: 'var(--surface-elevated)' }}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {applyVariables(content, variables)}
            </Markdown>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onContextMenu={handleContextMenu}
            className="w-full min-h-[500px] p-4 text-[13px] font-mono outline-none resize-y"
            style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', lineHeight: 1.6 }}
            placeholder="Markdown контент статьи… Правый клик — вставить переменную"
          />
        )}
      </div>

      <SelectionToolbar
        textareaRef={textareaRef}
        content={content}
        onChange={setContent}
      />

      {/* Контекстное меню переменных — рендерится в document.body чтобы не зависеть от родительских transform */}
      {varMenu && createPortal(
        <div
          ref={menuRef}
          className="rounded-2xl overflow-hidden shadow-lg"
          style={{
            ...getMenuStyle(varMenu.x, varMenu.y),
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
            style={{
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            Вставить переменную
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            {varGroups.map((group) => (
              <div key={group.label}>
                <div
                  className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group.label}
                </div>
                {group.vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors hover:opacity-80"
                    style={{ background: 'transparent', color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-success-bg)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span className="text-[12px] font-medium">{v.name}</span>
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-full ml-2 shrink-0"
                      style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}
                    >
                      {v.value}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Модалка подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={18} style={{ color: 'var(--apex-danger)' }} />
              <h3 className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                Удалить статью?
              </h3>
            </div>
            <p className="text-[13px] font-medium mb-5" style={{ color: 'var(--text-secondary)' }}>
              Статья «{title}» будет удалена безвозвратно.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-full text-[12px] font-bold transition-colors"
                style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-full text-[12px] font-bold text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--apex-danger)' }}
              >
                {isPending ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
