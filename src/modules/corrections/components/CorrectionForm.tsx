'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal, Eye, Play, ChevronDown, Check, Search } from 'lucide-react'

import type { AvailableEventType, CorrectionInput, CorrectionTransaction } from '../types'

type UiScenario = 'fix_ws_day' | 'fix_revit_day' | 'transactions'
type TxMode = 'add' | 'remove'

const EVENT_TYPE_LABELS: Record<string, string> = {
  red_day: 'Красный день',
  green_day: 'Зелёный день',
  wrong_status_report: 'Время не в статусе «В работе»',
  task_dynamics_violation: 'Нарушение динамики задачи',
  section_red: 'Нарушение в разделе',
  streak_reset_timetracking: 'Сброс стрика (таймтрекинг)',
  streak_reset_wrong_status: 'Сброс стрика (статус)',
  streak_reset_section: 'Сброс стрика (раздел)',
  streak_reset_dynamics: 'Сброс стрика (динамика)',
  revit_streak_reset: 'Сброс Revit-стрика',
  revit_using_plugins: 'Использование Revit',
  ws_streak_7: 'Бонус за стрик 7 дней (WS)',
  ws_streak_30: 'Бонус за стрик 30 дней (WS)',
  ws_streak_90: 'Бонус за стрик 90 дней (WS)',
  revit_streak_7_bonus: 'Бонус за Revit-стрик 7 дней',
  revit_streak_30_bonus: 'Бонус за Revit-стрик 30 дней',
  gratitude_recipient_points: 'Благодарность получена',
  gratitude_gift_sent: 'Благодарность отправлена',
  ach_personal: 'Личное достижение',
  ach_team: 'Командное достижение',
  ach_department: 'Достижение отдела',
  shop_purchase: 'Покупка в магазине',
  shop_refund: 'Возврат из магазина',
  master_planner: 'Мастер планирования',
  team_contest_top1_bonus: 'Бонус команде-победителю',
  budget_ok_l2: 'Бюджет L2 в норме',
  budget_ok_l3: 'Бюджет L3 в норме',
  budget_ok_l3_lead_bonus: 'Бонус тимлиду за бюджет',
  budget_revoked_l2: 'Отзыв: бюджет L2',
  budget_revoked_l3: 'Отзыв: бюджет L3',
  budget_revoked_l3_lead: 'Отзыв: бонус тимлиду',
  deadline_ok_l3: 'Срок L3 в норме',
  deadline_revoked_l3: 'Отзыв: срок L3',
}

const SOURCE_LABELS: Record<string, string> = {
  ws: 'Worksection',
  revit: 'Revit',
  gratitudes: 'Благодарности',
  achievements: 'Достижения',
  contest: 'Соревнование',
  shop: 'Магазин',
  admin: 'Админ',
}

const SOURCE_COLORS: Record<string, string> = {
  ws: 'var(--apex-success-text)',
  revit: 'var(--apex-warning-text)',
  gratitudes: 'var(--apex-info-text)',
  achievements: 'var(--apex-primary)',
  contest: 'var(--apex-primary)',
  shop: 'var(--apex-text-secondary)',
  admin: 'var(--apex-text-secondary)',
}

function labelForEventType(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function formatCoins(n: number): string {
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '−'}${new Intl.NumberFormat('ru-RU').format(Math.abs(n))}`
}

interface CorrectionFormProps {
  scenario: UiScenario
  onScenarioChange: (value: UiScenario) => void
  txMode: TxMode
  onTxModeChange: (value: TxMode) => void
  selectedDates: string[]
  // WS
  wsMode: 'green' | 'absent' | 'red'
  onWsModeChange: (v: 'green' | 'absent' | 'red') => void
  wsAbsenceType: 'vacation' | 'sick_leave' | 'sick_day' | 'day_off'
  onWsAbsenceTypeChange: (v: 'vacation' | 'sick_leave' | 'sick_day' | 'day_off') => void
  // Revit
  revitMode: 'add' | 'remove'
  onRevitModeChange: (v: 'add' | 'remove') => void
  revitPluginName: string
  onRevitPluginNameChange: (v: string) => void
  // Delete tx
  transactions: CorrectionTransaction[]
  selectedTransactionId: string
  onSelectedTransactionIdChange: (v: string) => void
  // Add transaction
  availableEventTypes: AvailableEventType[]
  addEventType: string
  onAddEventTypeChange: (v: string) => void
  addEventDate: string
  onAddEventDateChange: (v: string) => void
  addCoinsOverride: string
  onAddCoinsOverrideChange: (v: string) => void
  addDescription: string
  onAddDescriptionChange: (v: string) => void
  // Общее
  reason: string
  onReasonChange: (v: string) => void
  pending: boolean
  onPreview: () => void
  onApply: () => void
  canSubmit: boolean
  input: CorrectionInput | null
}

export function CorrectionForm(props: CorrectionFormProps) {
  const {
    scenario, onScenarioChange,
    txMode, onTxModeChange,
    selectedDates,
    wsMode, onWsModeChange, wsAbsenceType, onWsAbsenceTypeChange,
    revitMode, onRevitModeChange, revitPluginName, onRevitPluginNameChange,
    transactions, selectedTransactionId, onSelectedTransactionIdChange,
    availableEventTypes,
    addEventType, onAddEventTypeChange,
    addEventDate, onAddEventDateChange,
    addCoinsOverride, onAddCoinsOverrideChange,
    addDescription, onAddDescriptionChange,
    reason, onReasonChange,
    pending, onPreview, onApply, canSubmit,
  } = props

  return (
    <section
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={14} style={{ color: 'var(--apex-primary)' }} />
        <h3 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Корректировка
        </h3>
      </div>

      <Field label="Сценарий">
        <Segmented
          value={scenario}
          onChange={(v) => onScenarioChange(v as UiScenario)}
          options={[
            { value: 'fix_ws_day', label: 'WS-день' },
            { value: 'fix_revit_day', label: 'Revit-день' },
            { value: 'transactions', label: 'Транзакции' },
          ]}
        />
      </Field>

      {scenario === 'transactions' ? (
        <Field label="Что сделать">
          <ActionCards
            value={txMode}
            onChange={(v) => onTxModeChange(v as TxMode)}
            options={[
              { value: 'add', label: 'Добавить транзакцию', hint: 'создать событие и начислить/списать 💎' },
              { value: 'remove', label: 'Удалить транзакцию', hint: 'снять событие с возвратом баланса' },
            ]}
          />
        </Field>
      ) : null}

      {scenario === 'fix_ws_day' ? (
        <>
          <Field label="Выбранные дни">
            <SelectedDates dates={selectedDates} />
          </Field>
          <Field label="Что сделать">
            <ActionCards
              value={wsMode}
              onChange={(v) => onWsModeChange(v as 'green' | 'absent' | 'red')}
              options={[
                { value: 'green', label: 'Сделать зелёным', hint: 'начислить +15 💎 и зачесть в стрик' },
                { value: 'absent', label: 'Отметить отсутствием', hint: 'заморозить день (стрик не рвётся)' },
                { value: 'red', label: 'Сделать красным', hint: 'сломать стрик и забрать начисления дня' },
              ]}
            />
          </Field>
          {wsMode === 'absent' ? (
            <Field label="Тип отсутствия">
              <Segmented
                value={wsAbsenceType}
                onChange={(v) => onWsAbsenceTypeChange(v as 'vacation' | 'sick_leave' | 'sick_day' | 'day_off')}
                options={[
                  { value: 'vacation', label: 'Отпуск' },
                  { value: 'sick_leave', label: 'Больничный' },
                  { value: 'sick_day', label: 'По болезни' },
                  { value: 'day_off', label: 'Выходной' },
                ]}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {scenario === 'fix_revit_day' ? (
        <>
          <Field label="Выбранные дни">
            <SelectedDates dates={selectedDates} />
          </Field>
          <Field label="Что сделать">
            <ActionCards
              value={revitMode}
              onChange={(v) => onRevitModeChange(v as 'add' | 'remove')}
              options={[
                { value: 'add', label: 'Добавить Revit-день', hint: 'засчитать запуск плагина (+10 💎)' },
                { value: 'remove', label: 'Убрать Revit-начисление', hint: 'отозвать 💎 за запуск' },
              ]}
            />
          </Field>
          {revitMode === 'add' ? (
            <Field label="Имя плагина (не обязательно)">
              <input
                className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
                placeholder="ManualCorrection"
                value={revitPluginName}
                onChange={(e) => onRevitPluginNameChange(e.target.value)}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {scenario === 'transactions' && txMode === 'remove' ? (
        <Field label="Транзакция">
          <TransactionDropdown
            transactions={transactions}
            value={selectedTransactionId}
            onChange={onSelectedTransactionIdChange}
          />
        </Field>
      ) : null}

      {scenario === 'transactions' && txMode === 'add' ? (
        <>
          <Field label="Тип события">
            <EventTypeDropdown
              types={availableEventTypes}
              value={addEventType}
              onChange={onAddEventTypeChange}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Дата">
              <input
                type="date"
                value={addEventDate}
                onChange={(e) => onAddEventDateChange(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
              />
            </Field>
            <Field label="Сумма (💎, пусто = по умолчанию)">
              <input
                type="number"
                step={1}
                value={addCoinsOverride}
                onChange={(e) => onAddCoinsOverrideChange(e.target.value)}
                placeholder={addEventType
                  ? String(availableEventTypes.find((t) => t.key === addEventType)?.coins ?? 0)
                  : '—'}
                className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
              />
            </Field>
          </div>
          <Field label="Описание (не обязательно)">
            <input
              type="text"
              value={addDescription}
              onChange={(e) => onAddDescriptionChange(e.target.value)}
              maxLength={500}
              className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
              style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
            />
          </Field>
        </>
      ) : null}

      <Field label="Причина (обязательно)">
        <textarea
          className="w-full rounded-xl px-3 py-2 text-[13px] outline-none resize-none"
          style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
          rows={2}
          placeholder="Почему эта правка нужна и чем подтверждена..."
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onPreview}
          disabled={!canSubmit || pending}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-50"
          style={{ background: 'var(--apex-surface)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)' }}
        >
          <Eye size={13} /> Предпросмотр
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!canSubmit || pending}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-50"
          style={{ background: 'var(--apex-primary)', color: 'var(--apex-on-primary)', border: '1px solid var(--apex-primary)' }}
        >
          <Play size={13} /> Применить
        </button>
      </div>
    </section>
  )
}

// -----------------------------------------------------------
// Primitives
// -----------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--apex-text-muted)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function ActionCards<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; hint?: string }>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className="rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all"
            style={{
              background: active ? 'var(--apex-info-bg)' : 'var(--apex-bg)',
              border: active
                ? '1px solid var(--apex-primary)'
                : '1px solid var(--apex-border)',
              color: active ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div
      className="inline-flex flex-wrap rounded-xl p-1 gap-1"
      style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="text-[12px] px-3 py-1.5 rounded-lg font-semibold transition-colors"
            style={{
              background: active ? 'var(--apex-surface)' : 'transparent',
              color: active ? 'var(--apex-text)' : 'var(--apex-text-muted)',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SelectedDates({ dates }: { dates: string[] }) {
  if (dates.length === 0) {
    return (
      <div className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
        Нет выбора — кликните по дням в календаре.
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {dates.sort().map((d) => (
        <span
          key={d}
          className="text-[11px] px-2 py-0.5 rounded-full font-mono"
          style={{ background: 'var(--apex-bg)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)' }}
        >
          {d}
        </span>
      ))}
    </div>
  )
}

// -----------------------------------------------------------
// TransactionDropdown — кастомный селектор транзакции
// -----------------------------------------------------------

interface TransactionDropdownProps {
  transactions: CorrectionTransaction[]
  value: string
  onChange: (v: string) => void
}

function TransactionDropdown({ transactions, value, onChange }: TransactionDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () => transactions.find((tx) => tx.transaction_id === value) ?? null,
    [transactions, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return transactions
    return transactions.filter((tx) => {
      const label = labelForEventType(tx.event_type).toLowerCase()
      return (
        label.includes(q) ||
        tx.event_type.toLowerCase().includes(q) ||
        tx.source.toLowerCase().includes(q) ||
        tx.event_date.includes(q) ||
        (tx.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [transactions, query])

  // Закрытие по клику снаружи и по Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-xl px-3 h-11 text-left text-[13px] transition-colors"
        style={{
          background: 'var(--apex-bg)',
          border: `1px solid ${open ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
          color: 'var(--apex-text)',
        }}
      >
        {selected ? (
          <TransactionLine tx={selected} compact />
        ) : (
          <span style={{ color: 'var(--apex-text-muted)' }}>— выбрать транзакцию —</span>
        )}
        <ChevronDown
          size={14}
          className="ml-auto flex-shrink-0 transition-transform"
          style={{
            color: 'var(--apex-text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] rounded-xl z-30 overflow-hidden"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 h-10"
            style={{ borderBottom: '1px solid var(--apex-border)' }}
          >
            <Search size={14} style={{ color: 'var(--apex-text-muted)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по типу, дате, описанию..."
              className="flex-1 bg-transparent outline-none text-[12px]"
              style={{ color: 'var(--apex-text)' }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-[11px]"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                очистить
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-center" style={{ color: 'var(--apex-text-muted)' }}>
                Ничего не нашли
              </div>
            ) : (
              filtered.map((tx) => (
                <button
                  key={tx.transaction_id}
                  type="button"
                  onClick={() => {
                    onChange(tx.transaction_id)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="w-full text-left px-3 py-2 transition-colors"
                  style={{
                    background: tx.transaction_id === value ? 'var(--apex-info-bg)' : 'transparent',
                    borderBottom: '1px solid var(--apex-border)',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <TransactionLine tx={tx} />
                    {tx.transaction_id === value ? (
                      <Check size={14} className="mt-1 flex-shrink-0" style={{ color: 'var(--apex-primary)' }} />
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// -----------------------------------------------------------
// EventTypeDropdown — для сценария add_transaction
// -----------------------------------------------------------

function EventTypeDropdown({
  types,
  value,
  onChange,
}: {
  types: AvailableEventType[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(() => types.find((t) => t.key === value) ?? null, [types, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return types
    return types.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.key.toLowerCase().includes(q) ||
      (SOURCE_LABELS[t.source] ?? t.source).toLowerCase().includes(q),
    )
  }, [types, query])

  const grouped = useMemo(() => {
    const map = new Map<AvailableEventType['source'], AvailableEventType[]>()
    for (const t of filtered) {
      const arr = map.get(t.source) ?? []
      arr.push(t)
      map.set(t.source, arr)
    }
    return map
  }, [filtered])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-xl px-3 h-11 text-left text-[13px] transition-colors"
        style={{
          background: 'var(--apex-bg)',
          border: `1px solid ${open ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
          color: 'var(--apex-text)',
        }}
      >
        {selected ? (
          <EventTypeLine type={selected} />
        ) : (
          <span style={{ color: 'var(--apex-text-muted)' }}>— выбрать тип события —</span>
        )}
        <ChevronDown
          size={14}
          className="ml-auto flex-shrink-0 transition-transform"
          style={{
            color: 'var(--apex-text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] rounded-xl z-30 overflow-hidden"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 h-10"
            style={{ borderBottom: '1px solid var(--apex-border)' }}
          >
            <Search size={14} style={{ color: 'var(--apex-text-muted)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию..."
              className="flex-1 bg-transparent outline-none text-[12px]"
              style={{ color: 'var(--apex-text)' }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-[11px]"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                очистить
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-center" style={{ color: 'var(--apex-text-muted)' }}>
                Ничего не нашли
              </div>
            ) : (
              [...grouped.entries()].map(([src, items]) => (
                <div key={src}>
                  <div
                    className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)' }}
                  >
                    {SOURCE_LABELS[src] ?? src}
                  </div>
                  {items.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        onChange(t.key)
                        setOpen(false)
                        setQuery('')
                      }}
                      className="w-full text-left px-3 py-2 transition-colors"
                      style={{
                        background: t.key === value ? 'var(--apex-info-bg)' : 'transparent',
                        borderBottom: '1px solid var(--apex-border)',
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <EventTypeLine type={t} />
                        {t.key === value ? (
                          <Check size={14} className="mt-1 flex-shrink-0" style={{ color: 'var(--apex-primary)' }} />
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EventTypeLine({ type }: { type: AvailableEventType }) {
  const coinColor = type.coins > 0 ? 'var(--apex-success-text)' : type.coins < 0 ? 'var(--apex-danger)' : 'var(--apex-text-muted)'
  return (
    <div className="min-w-0 flex-1 flex items-center gap-2">
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
        style={{
          background: 'var(--apex-bg)',
          color: SOURCE_COLORS[type.source] ?? 'var(--apex-text-secondary)',
          border: '1px solid var(--apex-border)',
        }}
      >
        {SOURCE_LABELS[type.source] ?? type.source}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] truncate" style={{ color: 'var(--apex-text)' }}>
          {type.name}
        </div>
      </div>
      <div className="shrink-0 text-[12px] font-mono font-semibold" style={{ color: coinColor }}>
        {formatCoins(type.coins)} 💎
      </div>
    </div>
  )
}

function TransactionLine({ tx, compact }: { tx: CorrectionTransaction; compact?: boolean }) {
  const coinColor = tx.coins > 0 ? 'var(--apex-success-text)' : tx.coins < 0 ? 'var(--apex-danger)' : 'var(--apex-text-muted)'
  return (
    <div className="min-w-0 flex-1 flex items-center gap-2">
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
        style={{
          background: 'var(--apex-bg)',
          color: SOURCE_COLORS[tx.source] ?? 'var(--apex-text-secondary)',
          border: '1px solid var(--apex-border)',
        }}
      >
        {SOURCE_LABELS[tx.source] ?? tx.source}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] truncate" style={{ color: 'var(--apex-text)' }}>
          {labelForEventType(tx.event_type)}
        </div>
        {!compact && tx.description ? (
          <div className="text-[10px] truncate" style={{ color: 'var(--apex-text-muted)' }}>
            {tx.description}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[11px] font-mono" style={{ color: 'var(--apex-text-muted)' }}>
          {formatDate(tx.event_date)}
        </div>
        <div className="text-[12px] font-mono font-semibold" style={{ color: coinColor }}>
          {formatCoins(tx.coins)} 💎
        </div>
      </div>
    </div>
  )
}
