'use client'

import { useState } from 'react'
import { X, Plus, Minus, Equal, Trash2, Check } from 'lucide-react'

import type { BulkUpdateOp } from '@/modules/shop/index.client'

interface BulkActionBarProps {
  selectedCount: number
  isPending: boolean
  onApply: (op: BulkUpdateOp) => void
  onDelete: () => void
  onClear: () => void
}

type NumericFieldKey = 'cost_byn' | 'coefficient' | 'discount_percent' | 'stock'
type FieldKey = NumericFieldKey | 'status'
type NumericOp = 'add' | 'subtract' | 'set'
type StatusValue = 'active' | 'inactive' | 'coming_soon'

const FIELDS: { key: FieldKey; label: string; unit: string }[] = [
  { key: 'cost_byn', label: 'Себестоимость', unit: 'BYN' },
  { key: 'coefficient', label: 'Коэффициент', unit: '×' },
  { key: 'discount_percent', label: 'Скидка', unit: '%' },
  { key: 'stock', label: 'Остаток', unit: 'шт' },
  { key: 'status', label: 'Статус', unit: '' },
]

const OPS: { op: NumericOp; icon: typeof Plus; hint: string }[] = [
  { op: 'add', icon: Plus, hint: 'Прибавить ко всем' },
  { op: 'subtract', icon: Minus, hint: 'Вычесть у всех' },
  { op: 'set', icon: Equal, hint: 'Выставить значение' },
]

const STATUS_OPTIONS: { value: StatusValue; label: string; bg: string; text: string }[] = [
  { value: 'active', label: 'Активен', bg: 'var(--apex-success-bg)', text: 'var(--apex-success-text)' },
  { value: 'coming_soon', label: 'Скоро', bg: 'var(--apex-warning-bg)', text: 'var(--apex-warning-text)' },
  { value: 'inactive', label: 'Неактивен', bg: 'var(--apex-bg)', text: 'var(--apex-text-muted)' },
]

export function BulkActionBar({ selectedCount, isPending, onApply, onDelete, onClear }: BulkActionBarProps) {
  const [field, setField] = useState<FieldKey>('cost_byn')
  const [op, setOp] = useState<NumericOp>('add')
  const [value, setValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNumeric = field !== 'status'

  function applyNumeric() {
    if (field === 'status') return
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num)) return
    // field сужено до NumericFieldKey, но discriminated union не выводится из union-дискриминанта
    onApply({ field, op, value: num } as BulkUpdateOp)
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-5 py-3"
      style={{ background: 'var(--apex-success-bg)', borderBottom: '1px solid var(--apex-border)' }}
    >
      <span className="text-[13px] font-semibold shrink-0" style={{ color: 'var(--apex-primary)' }}>
        Выбрано: {selectedCount}
      </span>

      {/* Выбор поля */}
      <select
        value={field}
        onChange={(e) => setField(e.target.value as FieldKey)}
        disabled={isPending}
        className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
      >
        {FIELDS.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>

      {isNumeric ? (
        <div className="flex items-center gap-2">
          {/* Операция */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--apex-border)' }}>
            {OPS.map(({ op: o, icon: Icon, hint }) => (
              <button
                key={o}
                onClick={() => setOp(o)}
                disabled={isPending}
                title={hint}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{
                  background: op === o ? 'var(--apex-primary)' : 'var(--apex-surface)',
                  color: op === o ? 'white' : 'var(--apex-text-muted)',
                }}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>

          {/* Значение */}
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyNumeric() }}
            placeholder="0"
            className="w-20 px-2.5 py-1.5 rounded-lg text-[13px] outline-none"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
          />
          <span className="text-[12px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
            {FIELDS.find((f) => f.key === field)?.unit}
          </span>

          <button
            onClick={applyNumeric}
            disabled={isPending || value.trim() === ''}
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: 'var(--apex-primary)', color: 'white', opacity: isPending || value.trim() === '' ? 0.5 : 1 }}
          >
            Применить
          </button>

          {field === 'discount_percent' && (
            <button
              onClick={() => onApply({ field: 'discount_percent', op: 'clear' })}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-muted)' }}
            >
              Убрать скидку
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => onApply({ field: 'status', value: s.value })}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity"
              style={{ background: s.bg, color: s.text, opacity: isPending ? 0.5 : 1 }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Удаление выбранных — с подтверждением */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-[12px] font-medium" style={{ color: 'var(--apex-danger)' }}>
              Удалить {selectedCount}?
            </span>
            <button
              onClick={() => { setConfirmDelete(false); onDelete() }}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
            >
              <Check size={13} />
              Да
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
          >
            <Trash2 size={13} />
            Удалить
          </button>
        )}

        <button
          onClick={onClear}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-[12px] font-medium"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          <X size={13} />
          Снять выделение
        </button>
      </div>
    </div>
  )
}
