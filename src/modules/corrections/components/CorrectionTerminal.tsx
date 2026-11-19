'use client'

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  SkipForward,
  AlertTriangle,
  Minus,
} from 'lucide-react'

import type { CorrectionLog, CorrectionStep, CorrectionStepState } from '../types'

interface CorrectionTerminalProps {
  log: CorrectionLog | null
  pending: boolean
  title?: string
}

export function CorrectionTerminal({ log, pending, title }: CorrectionTerminalProps) {
  return (
    <section
      className="rounded-2xl p-4 min-h-[280px]"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <header className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-[13px] font-bold" style={{ color: 'var(--apex-text)' }}>
          {title ?? 'Терминал корректировки'}
        </h3>
        {log ? <StatusBadge status={log.status} /> : pending ? <PendingBadge /> : null}
      </header>

      {log === null && !pending ? (
        <EmptyHint />
      ) : (
        <>
          {log ? <Summary log={log} /> : null}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
          >
            {pending && (!log || log.steps.length === 0) ? <RunningLine /> : null}
            {log?.steps.map((step, idx) => (
              <StepLine key={step.n} step={step} isLast={idx === log.steps.length - 1 && !log.error} />
            ))}
            {log?.error ? <ErrorLine message={log.error} /> : null}
          </div>
        </>
      )}
    </section>
  )
}

// ===========================================================
// Итоговая строка над терминалом
// ===========================================================

function Summary({ log }: { log: CorrectionLog }) {
  const before = log.steps.find((s) => s.key === 'snapshot_before')?.data ?? null
  const after = log.steps.find((s) => s.key === 'snapshot_after')?.data ?? null
  const balBefore = numField(before, 'balance')
  const balAfter = numField(after, 'balance')
  const streakBefore = numField(before, 'streak')
  const streakAfter = numField(after, 'streak')

  const parts: string[] = []
  parts.push(`${log.steps.length} шагов`)
  if (balBefore !== null && balAfter !== null) {
    const diff = balAfter - balBefore
    parts.push(`баланс ${diff >= 0 ? '+' : ''}${formatNumber(diff)}💎`)
  }
  if (streakBefore !== null && streakAfter !== null && streakBefore !== streakAfter) {
    parts.push(`стрик ${streakBefore} → ${streakAfter}`)
  }

  const label = log.status === 'preview' ? 'Если применить:' : log.status === 'ok' ? 'Готово:' : 'Прервано:'

  return (
    <div className="text-[12px] mb-2 px-1" style={{ color: 'var(--apex-text-secondary)' }}>
      <span className="font-semibold" style={{ color: 'var(--apex-text)' }}>
        {label}
      </span>{' '}
      {parts.join(' · ')}
    </div>
  )
}

// ===========================================================
// Элемент шага — плоская строка в общем списке
// ===========================================================

function StepLine({ step, isLast }: { step: CorrectionStep; isLast: boolean }) {
  const formatted = formatStep(step)
  const { icon: Icon, color } = iconForState(step.state)

  return (
    <div
      className="flex gap-3 items-start px-3 py-2 text-[12px]"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--apex-border)' }}
    >
      <span
        className="font-mono text-[10px] mt-0.5 flex-shrink-0 w-6"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        [{String(step.n).padStart(2, '0')}]
      </span>
      <Icon size={13} className="mt-0.5 flex-shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="font-medium" style={{ color: 'var(--apex-text)' }}>
          {formatted.title}
        </div>
        {formatted.subtitle ? (
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--apex-text-muted)' }}>
            {formatted.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ===========================================================
// Форматирование по типам шагов
// ===========================================================

interface FormattedStep {
  title: string
  subtitle?: string
}

function formatStep(step: CorrectionStep): FormattedStep {
  const d = step.data

  switch (step.key) {
    case 'snapshot_before':
    case 'snapshot_after': {
      const isBefore = step.key === 'snapshot_before'
      const streak = numField(d, 'streak')
      const balance = numField(d, 'balance')
      const txSum = numField(d, 'tx_sum')
      const balanceMismatch = Boolean(d.balance_mismatch)
      const mode = strField(d, 'mode')
      const dates = Array.isArray(d.dates) ? (d.dates as string[]) : []
      const reason = strField(d, 'reason')

      const metrics: string[] = []
      if (streak !== null) metrics.push(`стрик ${streak}`)
      if (balance !== null) metrics.push(`баланс ${formatNumber(balance)} 💎`)
      if (balanceMismatch && txSum !== null && balance !== null) {
        metrics.push(`баланс ≠ транзакций (${formatNumber(balance)} vs ${formatNumber(txSum)})`)
      }

      const extras: string[] = []
      if (isBefore && mode) extras.push(describeMode(mode))
      if (isBefore && dates.length > 0) extras.push(dates.map(formatDate).join(', '))
      if (isBefore && reason) extras.push(`причина: ${reason}`)

      return {
        title: `${isBefore ? 'Состояние до' : 'Состояние после'} — ${metrics.join(', ') || '—'}`,
        subtitle: extras.length > 0 ? extras.join(' · ') : undefined,
      }
    }

    case 'check':
      return { title: step.message || 'Проверка', subtitle: describeFlags(d) }

    case 'day_skip': {
      const date = strField(d, 'date')
      const status = strField(d, 'status')
      return {
        title: `День ${date ? formatDate(date) : '—'} уже «${describeStatus(status ?? '')}» — пропуск`,
      }
    }

    case 'remove_red_day': {
      const date = strField(d, 'event_date')
      if (step.state === 'skip') {
        return { title: `Красный день за ${date ? formatDate(date) : '—'} не найден` }
      }
      return { title: `Удалён красный день за ${date ? formatDate(date) : '—'}` }
    }

    case 'remove_green_day': {
      const date = strField(d, 'event_date')
      const coins = numField(d, 'coins')
      return {
        title: `Удалён зелёный день за ${date ? formatDate(date) : '—'}`,
        subtitle: coins !== null ? `возврат ${formatCoinsSigned(-coins)}` : undefined,
      }
    }

    case 'add_red_day': {
      const date = strField(d, 'date')
      return { title: `Создано событие «красный день» за ${date ? formatDate(date) : '—'}` }
    }

    case 'add_transaction': {
      const type = strField(d, 'event_type')
      const date = strField(d, 'date')
      const coins = numField(d, 'coins')
      const source = strField(d, 'source')
      return {
        title: `Добавлено: ${describeEventType(type)}${date ? ` за ${formatDate(date)}` : ''}`,
        subtitle: [
          coins !== null ? formatCoinsSigned(coins) : null,
          source ? `источник: ${source}` : null,
        ].filter(Boolean).join(' · '),
      }
    }

    case 'remove_shield': {
      const rolled = Array.isArray(d.rolled_back)
        ? (d.rolled_back as Array<{ shield_type: string; date: string; was_free: boolean; order_id: string | null }>)
        : []
      if (rolled.length === 0) {
        return { title: step.message || 'Откат щита' }
      }
      const parts = rolled.map((r) => {
        const type = r.shield_type === 'ws' ? 'WS' : 'Revit'
        const kind = r.was_free ? 'бесплатный → возврат в квоту' : 'платный → возврат кристаллов'
        return `${type}-щит за ${formatDate(r.date)} (${kind})`
      })
      return {
        title: step.message || 'Откат щита',
        subtitle: parts.join(' · '),
      }
    }

    case 'remove_violation': {
      const date = strField(d, 'event_date')
      const type = strField(d, 'event_type')
      return {
        title: `Удалено нарушение «${describeEventType(type)}»`,
        subtitle: date ? `за ${formatDate(date)}` : undefined,
      }
    }

    case 'remove_streak_reset': {
      const date = strField(d, 'event_date')
      return { title: `Удалён ошибочный сброс стрика WS`, subtitle: date ? `за ${formatDate(date)}` : undefined }
    }

    case 'remove_revit_reset': {
      const date = strField(d, 'event_date')
      return { title: `Удалён ошибочный сброс Revit-стрика`, subtitle: date ? `за ${formatDate(date)}` : undefined }
    }

    case 'set_day_status': {
      const before = strField(d, 'status_before') ?? 'none'
      const after = strField(d, 'status_after') ?? '—'
      const absenceType = strField(d, 'absence_type')
      return {
        title: `Статус дня: ${describeStatus(before)} → ${describeStatus(after)}${absenceType ? ` (${describeAbsenceType(absenceType)})` : ''}`,
      }
    }

    case 'award_green_day': {
      const date = strField(d, 'date')
      const coins = numField(d, 'coins')
      return {
        title: `Начислен зелёный день за ${date ? formatDate(date) : '—'}`,
        subtitle: coins !== null ? `${formatCoinsSigned(coins)}` : undefined,
      }
    }

    case 'remove_revit_award': {
      const date = strField(d, 'event_date')
      const coins = numField(d, 'coins')
      return {
        title: `Отозваны Revit-кристаллы за ${date ? formatDate(date) : '—'}`,
        subtitle: `${coins !== null ? formatCoinsSigned(-coins) : ''} · день стал отсутствием`,
      }
    }

    case 'revit_add': {
      const date = strField(d, 'date')
      if (step.state === 'skip') {
        return { title: `Revit-день за ${date ? formatDate(date) : '—'} уже существует` }
      }
      if (step.state === 'warn') {
        return {
          title: `Запуск вставлен, но кристаллы не начислены`,
          subtitle: `${date ? formatDate(date) : ''} — выходной, отсутствие или неактивный пользователь`,
        }
      }
      return { title: `Добавлен Revit-день за ${date ? formatDate(date) : '—'}`, subtitle: '+10 💎' }
    }

    case 'revit_remove': {
      const date = strField(d, 'event_date')
      const coins = numField(d, 'coins')
      if (step.state === 'skip') {
        return { title: `Revit-начисление за ${date ? formatDate(date) : '—'} не найдено` }
      }
      return {
        title: `Отозваны кристаллы за Revit ${date ? formatDate(date) : '—'}`,
        subtitle: `${coins !== null ? formatCoinsSigned(-coins) : ''} · запуски в Kibana сохранены`,
      }
    }

    case 'replay_streak_ws':
    case 'replay_streak_revit': {
      const domain = step.key === 'replay_streak_ws' ? 'WS' : 'Revit'
      const anchorBefore = strField(d, 'anchor_before')
      const anchorAfter = strField(d, 'anchor_after')
      const cyclesBefore = numField(d, 'cycles_before')
      const cyclesAfter = numField(d, 'cycles_after')
      const longestBefore = numField(d, 'longest_before')
      const longestAfter = numField(d, 'longest_after')
      const currentStreak = numField(d, 'current_streak')
      const awarded = Array.isArray(d.bonuses_awarded)
        ? (d.bonuses_awarded as Array<{ type: string; date: string; coins: number }>)
        : Array.isArray(d.bonuses)
        ? (d.bonuses as Array<{ type: string; date: string; coins: number }>) // старый формат, на всякий случай
        : []
      const revoked = Array.isArray(d.bonuses_revoked)
        ? (d.bonuses_revoked as Array<{ type: string; date: string; coins: number }>)
        : []
      const pendingCleared = Boolean(d.pending_cleared)

      const parts: string[] = []
      if (currentStreak !== null) parts.push(`текущий стрик ${currentStreak}`)
      if (anchorBefore !== anchorAfter) {
        parts.push(`начало ${anchorBefore ? formatDate(anchorBefore) : 'нет'} → ${anchorAfter ? formatDate(anchorAfter) : 'нет'}`)
      }
      if (cyclesBefore !== null && cyclesAfter !== null && cyclesBefore !== cyclesAfter) {
        parts.push(`циклов ${cyclesBefore} → ${cyclesAfter}`)
      }
      if (longestBefore !== null && longestAfter !== null && longestBefore !== longestAfter) {
        parts.push(`рекорд ${longestBefore} → ${longestAfter}`)
      }
      if (pendingCleared) parts.push('снят отложенный сброс стрика')

      const awardedText = awarded.length > 0
        ? `Выданы бонусы: ${awarded.map((b) => `${describeEventType(b.type)} ${formatDate(b.date)} ${formatCoinsSigned(b.coins)}`).join(' · ')}`
        : null
      const revokedText = revoked.length > 0
        ? `Отозваны фантомные бонусы: ${revoked.map((b) => `${describeEventType(b.type)} ${formatDate(b.date)} ${formatCoinsSigned(-(b.coins ?? 0))}`).join(' · ')}`
        : null

      return {
        title: `Пересчёт стрика ${domain}`,
        subtitle: [parts.join(' · '), awardedText, revokedText].filter(Boolean).join(' · ') || 'без изменений',
      }
    }

    case 'remove_event': {
      const type = strField(d, 'event_type')
      const date = strField(d, 'event_date')
      const coins = numField(d, 'coins')
      const balanceBefore = numField(d, 'balance_before')
      const balanceAfter = numField(d, 'balance_after')
      return {
        title: `Транзакция удалена: ${describeEventType(type)}${date ? ` от ${formatDate(date)}` : ''}`,
        subtitle: `${coins !== null ? formatCoinsSigned(-coins) : ''}${
          balanceBefore !== null && balanceAfter !== null
            ? ` · баланс ${formatNumber(balanceBefore)} → ${formatNumber(balanceAfter)}`
            : ''
        }`,
      }
    }

    default:
      return { title: step.message || step.key }
  }
}

// ===========================================================
// Словари
// ===========================================================

function describeStatus(status: string): string {
  switch (status) {
    case 'green':
      return 'зелёный'
    case 'red':
      return 'красный'
    case 'absent':
      return 'отсутствие'
    case 'none':
      return 'нет записи'
    default:
      return status
  }
}

function describeAbsenceType(absenceType: string): string {
  switch (absenceType) {
    case 'vacation':
      return 'отпуск'
    case 'sick_leave':
      return 'больничный'
    case 'sick_day':
      return 'отгул по болезни'
    case 'day_off':
      return 'отгул'
    default:
      return absenceType
  }
}

function describeMode(mode: string): string {
  switch (mode) {
    case 'green':
      return 'красный → зелёный'
    case 'absent':
      return 'красный → отсутствие'
    case 'add':
      return 'добавить Revit-день'
    case 'remove':
      return 'убрать Revit-начисление'
    default:
      return mode
  }
}

function describeEventType(type: string | null): string {
  if (!type) return 'событие'
  const dict: Record<string, string> = {
    red_day: 'красный день',
    green_day: 'зелёный день',
    wrong_status_report: 'время не в статусе «В работе»',
    task_dynamics_violation: 'нарушение динамики задачи',
    section_red: 'нарушение в разделе',
    streak_reset_timetracking: 'сброс стрика (таймтрекинг)',
    streak_reset_wrong_status: 'сброс стрика (статус)',
    streak_reset_section: 'сброс стрика (раздел)',
    streak_reset_dynamics: 'сброс стрика (динамика)',
    revit_streak_reset: 'сброс Revit-стрика',
    revit_using_plugins: 'использование Revit',
    ws_streak_7: 'бонус за стрик 7 дней (WS)',
    ws_streak_30: 'бонус за стрик 30 дней (WS)',
    ws_streak_90: 'бонус за стрик 90 дней (WS)',
    revit_streak_7_bonus: 'бонус за Revit-стрик 7 дней',
    revit_streak_30_bonus: 'бонус за Revit-стрик 30 дней',
    gratitude_recipient_points: 'благодарность получена',
    gratitude_gift_sent: 'благодарность отправлена',
    ach_personal: 'личное достижение',
    ach_team: 'командное достижение',
    ach_department: 'достижение отдела',
    shop_purchase: 'покупка в магазине',
    shop_refund: 'возврат из магазина',
    master_planner: 'мастер планирования',
  }
  return dict[type] ?? type
}

function describeFlags(data: Record<string, unknown>): string | undefined {
  const parts: string[] = []
  if ('is_active' in data && data.is_active === false) parts.push('пользователь неактивен')
  return parts.join(' · ') || undefined
}

// ===========================================================
// Форматирование примитивов
// ===========================================================

function formatDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function formatCoinsSigned(n: number): string {
  if (n === 0) return '0 💎'
  return `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n))} 💎`
}

function numField(obj: Record<string, unknown> | null, key: string): number | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'number' ? v : null
}

function strField(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

// ===========================================================
// Служебные
// ===========================================================

function StatusBadge({ status }: { status: CorrectionLog['status'] }) {
  const map = {
    ok: { label: 'Применено', bg: 'var(--apex-success-bg)', color: 'var(--apex-success-text)' },
    preview: { label: 'Предпросмотр', bg: 'var(--apex-info-bg)', color: 'var(--apex-info-text)' },
    error: { label: 'Ошибка', bg: 'var(--apex-error-bg)', color: 'var(--apex-danger)' },
  } as const
  const cfg = map[status]
  return (
    <span
      className="inline-flex items-center text-[11px] px-2 py-1 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function PendingBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
      style={{ background: 'var(--apex-surface)', color: 'var(--apex-text-secondary)' }}
    >
      <Loader2 size={11} className="animate-spin" /> выполняем...
    </span>
  )
}

function RunningLine() {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-[12px]"
      style={{ color: 'var(--apex-text-muted)' }}
    >
      <Loader2 size={12} className="animate-spin" />
      Сервер обрабатывает запрос...
    </div>
  )
}

function EmptyHint() {
  return (
    <div
      className="rounded-xl p-3 text-[12px] text-center"
      style={{
        background: 'var(--apex-bg)',
        color: 'var(--apex-text-muted)',
        border: '1px dashed var(--apex-border)',
      }}
    >
      Выберите действие и нажмите «Предпросмотр» или «Применить»
    </div>
  )
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 text-[12px]"
      style={{ color: 'var(--apex-danger)', borderTop: '1px solid var(--apex-border)' }}
    >
      <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function iconForState(state: CorrectionStepState): { icon: typeof CheckCircle2; color: string } {
  switch (state) {
    case 'done':
      return { icon: CheckCircle2, color: 'var(--apex-success-text)' }
    case 'skip':
      return { icon: SkipForward, color: 'var(--apex-text-muted)' }
    case 'warn':
      return { icon: AlertTriangle, color: 'var(--apex-warning-text)' }
    case 'error':
      return { icon: AlertCircle, color: 'var(--apex-danger)' }
    default:
      return { icon: Minus, color: 'var(--apex-text-muted)' }
  }
}
