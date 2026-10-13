'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { History, ClipboardList, RefreshCw, ArrowLeft } from 'lucide-react'

import {
  applyCorrection,
  getCorrectionUserDetailAction,
  previewCorrection,
  correctionStatusLabels,
  correctionTypeLabels,
} from '@/modules/corrections/index.client'

import type {
  AdminCorrectionRow,
  CorrectionInput,
  CorrectionLog,
  CorrectionTransaction,
  CorrectionUserDetail,
} from '../types'

type UiScenario = 'fix_ws_day' | 'fix_revit_day' | 'transactions'
type TxMode = 'add' | 'remove'

import { UserStateCard } from './UserStateCard'
import { RedDayCalendar } from './RedDayCalendar'
import { CorrectionForm } from './CorrectionForm'
import { CorrectionTerminal } from './CorrectionTerminal'

interface CorrectionDetailShellProps {
  initialDetail: CorrectionUserDetail
}

export function CorrectionDetailShell({ initialDetail }: CorrectionDetailShellProps) {
  const [detail, setDetail] = useState<CorrectionUserDetail>(initialDetail)

  const [scenario, setScenario] = useState<UiScenario>('fix_ws_day')
  const [txMode, setTxMode] = useState<TxMode>('add')
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [wsMode, setWsMode] = useState<'green' | 'absent' | 'red'>('green')
  const [wsAbsenceType, setWsAbsenceType] = useState<'vacation' | 'sick_leave' | 'sick_day' | 'day_off'>('day_off')
  const [revitMode, setRevitMode] = useState<'add' | 'remove'>('add')
  const [revitPluginName, setRevitPluginName] = useState('')
  const [selectedTransactionId, setSelectedTransactionId] = useState('')
  // add_transaction
  const [addEventType, setAddEventType] = useState('')
  const [addEventDate, setAddEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [addCoinsOverride, setAddCoinsOverride] = useState('') // пусто = по умолчанию
  const [addDescription, setAddDescription] = useState('')
  const [reason, setReason] = useState('')

  const [log, setLog] = useState<CorrectionLog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'preview' | 'apply' | 'idle'>('idle')
  const [isPending, startTransition] = useTransition()

  const input = useMemo<CorrectionInput | null>(() => {
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return null
    if (scenario === 'fix_ws_day') {
      if (selectedDates.size === 0) return null
      return {
        correctionType: 'fix_ws_day',
        targetUserId: detail.user.id,
        dates: [...selectedDates],
        mode: wsMode,
        absenceType: wsMode === 'absent' ? wsAbsenceType : null,
        reason: trimmedReason,
      }
    }
    if (scenario === 'fix_revit_day') {
      if (selectedDates.size === 0) return null
      return {
        correctionType: 'fix_revit_day',
        targetUserId: detail.user.id,
        dates: [...selectedDates],
        mode: revitMode,
        pluginName: revitMode === 'add' ? (revitPluginName.trim() || null) : null,
        reason: trimmedReason,
      }
    }
    // scenario === 'transactions'
    if (txMode === 'remove') {
      if (!selectedTransactionId) return null
      return {
        correctionType: 'delete_transaction',
        targetUserId: detail.user.id,
        transactionId: selectedTransactionId,
        reason: trimmedReason,
      }
    }
    // txMode === 'add'
    if (!addEventType || !addEventDate) return null
    const coinsNum = addCoinsOverride.trim() === '' ? null : Number(addCoinsOverride)
    if (coinsNum !== null && Number.isNaN(coinsNum)) return null
    return {
      correctionType: 'add_transaction',
      targetUserId: detail.user.id,
      eventType: addEventType,
      eventDate: addEventDate,
      coinsOverride: coinsNum,
      description: addDescription.trim() || null,
      reason: trimmedReason,
    }
  }, [
    detail.user.id,
    scenario,
    txMode,
    selectedDates,
    wsMode,
    wsAbsenceType,
    revitMode,
    revitPluginName,
    selectedTransactionId,
    addEventType,
    addEventDate,
    addCoinsOverride,
    addDescription,
    reason,
  ])

  const refreshDetail = async () => {
    const result = await getCorrectionUserDetailAction(detail.user.id)
    if (result.success) setDetail(result.data)
  }

  const handlePreview = () => {
    if (!input) return
    setError(null)
    setLog(null)
    setMode('preview')
    startTransition(async () => {
      const result = await previewCorrection(input)
      if (result.success) setLog(result.data)
      else setError(result.error)
      setMode('idle')
    })
  }

  const handleApply = () => {
    if (!input) return
    setError(null)
    setLog(null)
    setMode('apply')
    startTransition(async () => {
      const result = await applyCorrection(input)
      if (result.success) {
        setLog(result.data)
        await refreshDetail()
      } else {
        setError(result.error)
      }
      setMode('idle')
    })
  }

  const canSubmit = input !== null && !isPending

  const handleToggleDate = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/admin/corrections"
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            color: 'var(--apex-text-secondary)',
          }}
        >
          <ArrowLeft size={14} />
          К списку пользователей
        </Link>
        <button
          type="button"
          onClick={() => void refreshDetail()}
          className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-lg"
          style={{ background: 'var(--apex-surface)', color: 'var(--apex-text-muted)', border: '1px solid var(--apex-border)' }}
          title="Обновить данные пользователя"
        >
          <RefreshCw size={12} /> обновить
        </button>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-3 min-w-0">
          <UserStateCard detail={detail} />
        <RedDayCalendar
          days={detail.calendar}
          selected={selectedDates}
          onToggle={handleToggleDate}
        />
        <TransactionsBlock transactions={detail.transactions.slice(0, 10)} />
        <HistoryBlock corrections={detail.corrections} onPickLog={setLog} />
      </div>

      <div className="space-y-3 min-w-0">
        <CorrectionForm
          scenario={scenario}
          onScenarioChange={(v) => {
            setScenario(v)
            setLog(null)
          }}
          txMode={txMode}
          onTxModeChange={(v) => {
            setTxMode(v)
            setLog(null)
          }}
          selectedDates={[...selectedDates]}
          wsMode={wsMode}
          onWsModeChange={setWsMode}
          wsAbsenceType={wsAbsenceType}
          onWsAbsenceTypeChange={setWsAbsenceType}
          revitMode={revitMode}
          onRevitModeChange={setRevitMode}
          revitPluginName={revitPluginName}
          onRevitPluginNameChange={setRevitPluginName}
          transactions={detail.transactions}
          selectedTransactionId={selectedTransactionId}
          onSelectedTransactionIdChange={setSelectedTransactionId}
          availableEventTypes={detail.availableEventTypes}
          addEventType={addEventType}
          onAddEventTypeChange={setAddEventType}
          addEventDate={addEventDate}
          onAddEventDateChange={setAddEventDate}
          addCoinsOverride={addCoinsOverride}
          onAddCoinsOverrideChange={setAddCoinsOverride}
          addDescription={addDescription}
          onAddDescriptionChange={setAddDescription}
          reason={reason}
          onReasonChange={setReason}
          pending={isPending}
          onPreview={handlePreview}
          onApply={handleApply}
          canSubmit={canSubmit}
          input={input}
        />

        {error ? (
          <div
            className="rounded-xl p-3 text-[12px]"
            style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
          >
            {error}
          </div>
        ) : null}

        <CorrectionTerminal
          log={log}
          pending={isPending}
          title={mode === 'apply' ? 'Применение' : mode === 'preview' ? 'Предпросмотр' : 'Терминал'}
        />
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------
// Transactions block
// -----------------------------------------------------------

function TransactionsBlock({ transactions }: { transactions: CorrectionTransaction[] }) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={14} style={{ color: 'var(--apex-primary)' }} />
        <h3 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Последние операции
        </h3>
      </div>
      {transactions.length === 0 ? (
        <div className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
          Пусто
        </div>
      ) : (
        <ul className="space-y-1.5">
          {transactions.map((tx) => (
            <li
              key={tx.transaction_id}
              className="flex items-center justify-between gap-3 text-[12px] py-1.5"
              style={{ borderBottom: '1px dashed var(--apex-border)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ color: 'var(--apex-text)' }}>
                  {tx.event_date} · {tx.event_type}
                </div>
                <div className="truncate text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                  {tx.description ?? tx.source}
                </div>
              </div>
              <div className="font-mono font-semibold" style={{ color: tx.coins >= 0 ? 'var(--apex-success-text)' : 'var(--apex-danger)' }}>
                {tx.coins > 0 ? '+' : ''}
                {tx.coins}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// -----------------------------------------------------------
// History block
// -----------------------------------------------------------

function HistoryBlock({
  corrections,
  onPickLog,
}: {
  corrections: AdminCorrectionRow[]
  onPickLog: (log: CorrectionLog) => void
}) {
  if (corrections.length === 0) return null

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <History size={14} style={{ color: 'var(--apex-primary)' }} />
        <h3 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          История корректировок
        </h3>
      </div>
      <ul className="space-y-1.5">
        {corrections.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 text-[12px] py-1.5"
            style={{ borderBottom: '1px dashed var(--apex-border)' }}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ color: 'var(--apex-text)' }}>
                {correctionTypeLabels[c.correction_type]} · {correctionStatusLabels[c.status]}
              </div>
              <div className="truncate text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                {new Date(c.created_at).toLocaleString('ru-RU')} · {c.reason}
              </div>
            </div>
            {c.executed_steps.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  onPickLog({
                    status: c.status === 'applied' ? 'ok' : 'error',
                    scenario: c.correction_type,
                    steps: c.executed_steps,
                    error: c.error_message ?? undefined,
                  })
                }
                className="text-[11px] px-2 py-1 rounded-full font-semibold"
                style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)' }}
              >
                Показать лог
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
