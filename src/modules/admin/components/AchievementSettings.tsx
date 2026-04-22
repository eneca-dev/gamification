'use client'

import { useState, useTransition } from 'react'
import { Trophy, Heart, Check, X, Pencil } from 'lucide-react'

import { updateRankingSetting, updateGratitudeSetting } from '@/modules/admin/index.client'

import type { RankingSettingRow, GratitudeSettingRow } from '../types'

// --- Словари ---

const AREA_LABELS: Record<string, string> = {
  revit: 'Revit',
  ws: 'Worksection',
}

const ENTITY_LABELS: Record<string, string> = {
  user: 'Личное',
  team: 'Команда',
  department: 'Отдел',
}

const CATEGORY_LABELS: Record<string, string> = {
  help: 'Поддержка коллег',
  quality: 'Проф. признание',
  mentoring: 'Наставничество',
}

const CATEGORY_EMOJIS: Record<string, string> = {
  help: '🤝',
  quality: '⭐',
  mentoring: '📚',
}

// --- Основной компонент ---

interface AchievementSettingsProps {
  rankingSettings: RankingSettingRow[]
  gratitudeSettings: GratitudeSettingRow[]
}

export function AchievementSettings({ rankingSettings, gratitudeSettings }: AchievementSettingsProps) {
  return (
    <div className="space-y-6" data-onboarding="admin-events-achievements">
      <RankingSettingsBlock initialItems={rankingSettings} />
      <GratitudeSettingsBlock initialItems={gratitudeSettings} />
    </div>
  )
}

// --- Рейтинговые достижения ---

function RankingSettingsBlock({ initialItems }: { initialItems: RankingSettingRow[] }) {
  const [items, setItems] = useState(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function rowKey(r: RankingSettingRow) {
    return `${r.area}_${r.entity_type}`
  }

  function startEdit(row: RankingSettingRow) {
    setEditingId(rowKey(row))
    setEditValue(String(row.threshold))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
    setError(null)
  }

  function saveEdit(row: RankingSettingRow) {
    const threshold = parseInt(editValue, 10)
    if (isNaN(threshold) || threshold < 1 || threshold > 31) {
      setError('Введите число от 1 до 31')
      return
    }

    const prev = items
    setItems(items.map((i) => (rowKey(i) === rowKey(row) ? { ...i, threshold } : i)))
    cancelEdit()

    startTransition(async () => {
      const result = await updateRankingSetting({ area: row.area, entity_type: row.entity_type, threshold })
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }

  function toggleActive(row: RankingSettingRow) {
    const prev = items
    setItems(items.map((i) => (rowKey(i) === rowKey(row) ? { ...i, is_active: !i.is_active } : i)))

    startTransition(async () => {
      const result = await updateRankingSetting({ area: row.area, entity_type: row.entity_type, is_active: !row.is_active })
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div
        className="flex items-center gap-2 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        <Trophy size={16} style={{ color: 'var(--orange-500)' }} />
        <span className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Рейтинговые достижения
        </span>
        <span className="text-[12px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
          Revit & Worksection
        </span>
      </div>

      {error && (
        <div
          className="px-5 py-2.5 text-[13px] font-medium"
          style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)', borderBottom: '1px solid var(--apex-border)' }}
        >
          {error}
        </div>
      )}

      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--apex-border)' }}>
            {['Область', 'Уровень', 'Дней в топе', 'Статус'].map((h) => (
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
            const id = rowKey(row)
            const isEditing = editingId === id

            return (
              <tr key={id} className="group" style={{ borderBottom: '1px solid var(--apex-border)' }}>
                <td className="px-5 py-3">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                    {AREA_LABELS[row.area] ?? row.area}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                    {ENTITY_LABELS[row.entity_type] ?? row.entity_type}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {isEditing ? (
                    <InlineNumberEdit
                      value={editValue}
                      onChange={setEditValue}
                      onSave={() => saveEdit(row)}
                      onCancel={cancelEdit}
                      isPending={isPending}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold" style={{ color: 'var(--apex-primary)' }}>
                        {row.threshold}
                      </span>
                      <button
                        onClick={() => startEdit(row)}
                        aria-label="Редактировать"
                        className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
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
                  )}
                </td>
                <td className="px-5 py-3">
                  <ToggleSwitch active={row.is_active} onToggle={() => toggleActive(row)} disabled={isPending} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Благодарности ---

function GratitudeSettingsBlock({ initialItems }: { initialItems: GratitudeSettingRow[] }) {
  const [items, setItems] = useState(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editField, setEditField] = useState<'threshold' | 'bonus_coins' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function startEdit(row: GratitudeSettingRow, field: 'threshold' | 'bonus_coins') {
    setEditingId(row.category)
    setEditField(field)
    setEditValue(String(field === 'threshold' ? row.threshold : row.bonus_coins))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditField(null)
    setEditValue('')
    setError(null)
  }

  function saveEdit(row: GratitudeSettingRow) {
    const val = parseInt(editValue, 10)
    if (isNaN(val) || val < 1) {
      setError('Введите положительное число')
      return
    }

    const field = editField!
    const prev = items
    setItems(items.map((i) => (i.category === row.category ? { ...i, [field]: val } : i)))
    cancelEdit()

    startTransition(async () => {
      const result = await updateGratitudeSetting({ category: row.category, [field]: val })
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }

  function toggleActive(row: GratitudeSettingRow) {
    const prev = items
    setItems(items.map((i) => (i.category === row.category ? { ...i, is_active: !i.is_active } : i)))

    startTransition(async () => {
      const result = await updateGratitudeSetting({ category: row.category, is_active: !row.is_active })
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div
        className="flex items-center gap-2 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        <Heart size={16} style={{ color: 'var(--tag-purple-text)' }} />
        <span className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Достижения по благодарностям
        </span>
      </div>

      {error && (
        <div
          className="px-5 py-2.5 text-[13px] font-medium"
          style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)', borderBottom: '1px solid var(--apex-border)' }}
        >
          {error}
        </div>
      )}

      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--apex-border)' }}>
            {['Категория', 'Порог подарков', 'Бонус 💎', 'Статус'].map((h) => (
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
            const isEditingThreshold = editingId === row.category && editField === 'threshold'
            const isEditingBonus = editingId === row.category && editField === 'bonus_coins'

            return (
              <tr key={row.category} className="group" style={{ borderBottom: '1px solid var(--apex-border)' }}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{CATEGORY_EMOJIS[row.category] ?? '💬'}</span>
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                      {CATEGORY_LABELS[row.category] ?? row.achievement_name}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {isEditingThreshold ? (
                    <InlineNumberEdit
                      value={editValue}
                      onChange={setEditValue}
                      onSave={() => saveEdit(row)}
                      onCancel={cancelEdit}
                      isPending={isPending}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold" style={{ color: 'var(--tag-purple-text)' }}>
                        {row.threshold}
                      </span>
                      <button
                        onClick={() => startEdit(row, 'threshold')}
                        aria-label="Редактировать"
                        className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
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
                  )}
                </td>
                <td className="px-5 py-3">
                  {isEditingBonus ? (
                    <InlineNumberEdit
                      value={editValue}
                      onChange={setEditValue}
                      onSave={() => saveEdit(row)}
                      onCancel={cancelEdit}
                      isPending={isPending}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold" style={{ color: 'var(--apex-success-text)' }}>
                        +{row.bonus_coins}
                      </span>
                      <button
                        onClick={() => startEdit(row, 'bonus_coins')}
                        aria-label="Редактировать"
                        className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
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
                  )}
                </td>
                <td className="px-5 py-3">
                  <ToggleSwitch active={row.is_active} onToggle={() => toggleActive(row)} disabled={isPending} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Вспомогательные компоненты ---

function InlineNumberEdit({
  value,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div
      className="flex items-center gap-2"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onCancel() }}
    >
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        className="w-16 px-2.5 py-1.5 rounded-lg text-[13px] outline-none"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-focus)',
          color: 'var(--apex-text)',
          boxShadow: '0 0 0 1px var(--apex-focus)',
        }}
        autoFocus
        disabled={isPending}
      />
      <button
        onClick={onSave}
        disabled={isPending}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0"
        style={{ background: 'var(--apex-primary)', color: 'white', opacity: isPending ? 0.6 : 1 }}
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        disabled={isPending}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0"
        style={{ background: 'var(--apex-surface)', color: 'var(--apex-text-muted)', border: '1px solid var(--apex-border)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ToggleSwitch({
  active,
  onToggle,
  disabled,
}: {
  active: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer">
      <button
        role="switch"
        aria-checked={active}
        onClick={onToggle}
        disabled={disabled}
        className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
        style={{ background: active ? 'var(--apex-primary)' : 'var(--apex-border)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: active ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
      <span
        className="text-[12px] font-medium select-none"
        style={{ color: active ? 'var(--apex-success-text)' : 'var(--apex-text-muted)' }}
      >
        {active ? 'Активно' : 'Выкл'}
      </span>
    </label>
  )
}
