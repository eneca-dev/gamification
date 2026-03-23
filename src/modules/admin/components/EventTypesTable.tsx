'use client'

import { useState, useTransition } from 'react'
import { Check, X, Pencil } from 'lucide-react'

import { updateEventType } from '@/modules/admin/index.client'

import type { EventTypeRow } from '../types'

interface EventTypesTableProps {
  eventTypes: EventTypeRow[]
}

type EditField = 'name' | 'coins' | 'description' | null

export function EventTypesTable({ eventTypes }: EventTypesTableProps) {
  const [items, setItems] = useState(eventTypes)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editField, setEditField] = useState<EditField>(null)
  const [editValue, setEditValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function startEdit(row: EventTypeRow, field: EditField) {
    setEditingKey(row.key)
    setEditField(field)
    if (field === 'coins') setEditValue(String(row.coins))
    else if (field === 'name') setEditValue(row.name)
    else setEditValue(row.description ?? '')
    setError(null)
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditField(null)
    setEditValue('')
    setError(null)
  }

  function saveEdit(key: string) {
    if (editField === 'coins') {
      const coins = parseInt(editValue, 10)
      if (isNaN(coins)) { setError('Введите число'); return }
      submitUpdate(key, { coins })
    } else if (editField === 'name') {
      const name = editValue.trim()
      if (!name) { setError('Название не может быть пустым'); return }
      submitUpdate(key, { name })
    } else if (editField === 'description') {
      submitUpdate(key, { description: editValue.trim() || null })
    }
  }

  function toggleActive(key: string, currentActive: boolean) {
    submitUpdate(key, { is_active: !currentActive })
  }

  function submitUpdate(
    key: string,
    fields: { name?: string; coins?: number; description?: string | null; is_active?: boolean }
  ) {
    const prev = items
    setItems(items.map((i) => (i.key === key ? { ...i, ...fields } : i)))
    cancelEdit()

    startTransition(async () => {
      const result = await updateEventType({ key, ...fields })
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {error && (
        <div
          className="px-5 py-2.5 text-[13px] font-medium"
          style={{
            background: 'var(--apex-error-bg)',
            color: 'var(--apex-danger)',
            borderBottom: '1px solid var(--apex-border)',
          }}
        >
          {error}
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--apex-border)' }}>
            {['Название', 'Ключ', 'Описание', 'Коины', 'Статус'].map((h) => (
              <th
                key={h}
                className="text-left text-[12px] font-semibold px-5 py-3"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const editing = editingKey === row.key ? editField : null

            return (
              <tr
                key={row.key}
                className="group"
                style={{ borderBottom: '1px solid var(--apex-border)' }}
              >
                {/* Название */}
                <td className="px-5 py-3">
                  {editing === 'name' ? (
                    <InlineEdit
                      value={editValue}
                      onChange={setEditValue}
                      onSave={() => saveEdit(row.key)}
                      onCancel={cancelEdit}
                      isPending={isPending}
                      width="w-44"
                    />
                  ) : (
                    <EditableCell
                      onClick={() => startEdit(row, 'name')}
                    >
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: 'var(--apex-text)' }}
                      >
                        {row.name}
                      </span>
                    </EditableCell>
                  )}
                </td>

                {/* Ключ */}
                <td className="px-5 py-3">
                  <code
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded-lg"
                    style={{
                      background: 'var(--apex-bg)',
                      color: 'var(--apex-text-muted)',
                    }}
                  >
                    {row.key}
                  </code>
                </td>

                {/* Описание */}
                <td className="px-5 py-3 max-w-[280px]">
                  {editing === 'description' ? (
                    <InlineEdit
                      value={editValue}
                      onChange={setEditValue}
                      onSave={() => saveEdit(row.key)}
                      onCancel={cancelEdit}
                      isPending={isPending}
                      placeholder="Описание события"
                      width="w-full"
                    />
                  ) : (
                    <EditableCell
                      onClick={() => startEdit(row, 'description')}
                    >
                      <span
                        className="text-[12px]"
                        style={{
                          color: row.description
                            ? 'var(--apex-text-secondary)'
                            : 'var(--apex-text-muted)',
                        }}
                      >
                        {row.description ?? '—'}
                      </span>
                    </EditableCell>
                  )}
                </td>

                {/* Коины */}
                <td className="px-5 py-3">
                  {editing === 'coins' ? (
                    <InlineEdit
                      value={editValue}
                      onChange={setEditValue}
                      onSave={() => saveEdit(row.key)}
                      onCancel={cancelEdit}
                      isPending={isPending}
                      type="number"
                      width="w-20"
                    />
                  ) : (
                    <EditableCell
                      onClick={() => startEdit(row, 'coins')}
                    >
                      <span
                        className="text-[14px] font-bold"
                        style={{
                          color:
                            row.coins > 0
                              ? 'var(--apex-success-text)'
                              : row.coins < 0
                                ? 'var(--apex-danger)'
                                : 'var(--apex-text-muted)',
                        }}
                      >
                        {row.coins > 0 ? '+' : ''}
                        {row.coins}
                      </span>
                    </EditableCell>
                  )}
                </td>

                {/* Статус */}
                <td className="px-5 py-3">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer">
                    <button
                      role="switch"
                      aria-checked={row.is_active}
                      onClick={() => toggleActive(row.key, row.is_active)}
                      disabled={isPending}
                      className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                      style={{
                        background: row.is_active
                          ? 'var(--apex-primary)'
                          : 'var(--apex-border)',
                      }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                        style={{
                          transform: row.is_active
                            ? 'translateX(16px)'
                            : 'translateX(0)',
                        }}
                      />
                    </button>
                    <span
                      className="text-[12px] font-medium select-none"
                      style={{
                        color: row.is_active
                          ? 'var(--apex-success-text)'
                          : 'var(--apex-text-muted)',
                      }}
                    >
                      {row.is_active ? 'Активно' : 'Неактивно'}
                    </span>
                  </label>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div
        className="px-5 py-3 text-[12px] font-medium"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        {items.length} событий
      </div>
    </div>
  )
}

// --- Вспомогательные компоненты ---

function EditableCell({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <button
        onClick={onClick}
        className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--apex-primary)'
          e.currentTarget.style.background = 'var(--apex-success-bg)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--apex-text-muted)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

function InlineEdit({
  value,
  onChange,
  onSave,
  onCancel,
  isPending,
  type = 'text',
  placeholder,
  width = 'w-full',
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  type?: 'text' | 'number'
  placeholder?: string
  width?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        className={`${width} px-2.5 py-1.5 rounded-lg text-[13px] outline-none`}
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-focus)',
          color: 'var(--apex-text)',
          boxShadow: '0 0 0 1px var(--apex-focus)',
        }}
        autoFocus
        disabled={isPending}
        placeholder={placeholder}
      />
      <button
        onClick={onSave}
        disabled={isPending}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0"
        style={{
          background: 'var(--apex-primary)',
          color: 'white',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        disabled={isPending}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0"
        style={{
          background: 'var(--apex-surface)',
          color: 'var(--apex-text-muted)',
          border: '1px solid var(--apex-border)',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
