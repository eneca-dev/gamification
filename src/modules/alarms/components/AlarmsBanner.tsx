'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Clock, Info, Check, ExternalLink, ChevronDown, ChevronUp, Undo2 } from 'lucide-react'
import { resolveAlarm, unresolveAlarm } from '@/modules/alarms/index.client'

import type { Alarm, AlarmSeverity } from '../types'

interface AlarmsBannerProps {
  alarms: Alarm[]
}

const SEVERITY_ORDER: Record<AlarmSeverity, number> = { critical: 0, warning: 1, info: 2 }

const SEVERITY_CONFIG: Record<AlarmSeverity, {
  bannerBg: string
  bannerBorder: string
  iconBg: string
  iconColor: string
  titleColor: string
  icon: typeof AlertTriangle
}> = {
  critical: {
    bannerBg: 'var(--apex-error-bg)',
    bannerBorder: '1px solid rgba(220, 38, 38, 0.2)',
    iconBg: 'var(--apex-error-bg)',
    iconColor: 'var(--apex-error-text)',
    titleColor: 'var(--apex-error-text)',
    icon: AlertTriangle,
  },
  warning: {
    bannerBg: 'var(--apex-warning-bg)',
    bannerBorder: '1px solid rgba(217, 119, 6, 0.2)',
    iconBg: 'var(--apex-warning-bg)',
    iconColor: 'var(--apex-warning-text)',
    titleColor: 'var(--apex-warning-dark)',
    icon: Clock,
  },
  info: {
    bannerBg: 'var(--apex-info-bg)',
    bannerBorder: '1px solid rgba(37, 99, 235, 0.2)',
    iconBg: 'var(--apex-info-bg)',
    iconColor: 'var(--apex-info-text)',
    titleColor: 'var(--apex-info-text)',
    icon: Info,
  },
}

const COLLAPSE_THRESHOLD = 3

export function AlarmsBanner({ alarms: initialAlarms }: AlarmsBannerProps) {
  // Начальное состояние: серверные resolved id
  const serverResolvedIds = new Set(initialAlarms.filter((a) => a.is_resolved).map((a) => a.id))
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(serverResolvedIds)
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (initialAlarms.length === 0) return null

  const isAlarmResolved = (id: number) => resolvedIds.has(id)

  // Активные сверху, решённые снизу
  const active = initialAlarms
    .filter((a) => !isAlarmResolved(a.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const resolved = initialAlarms
    .filter((a) => isAlarmResolved(a.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const sorted = [...active, ...resolved]

  const visible = expanded || sorted.length <= COLLAPSE_THRESHOLD ? sorted : sorted.slice(0, COLLAPSE_THRESHOLD)
  const hiddenCount = sorted.length - COLLAPSE_THRESHOLD
  const activeCount = active.length

  // Severity баннера определяется наиболее критичным активным алармом
  const topSeverity = active[0]?.severity ?? sorted[0].severity
  const headerConfig = SEVERITY_CONFIG[topSeverity]

  function handleResolve(alarmId: number) {
    const prev = new Set(resolvedIds)
    setResolvedIds(new Set([...resolvedIds, alarmId]))

    startTransition(async () => {
      const result = await resolveAlarm(alarmId)
      if (!result.success) {
        setResolvedIds(prev)
      }
    })
  }

  function handleUnresolve(alarmId: number) {
    const prev = new Set(resolvedIds)
    const next = new Set(resolvedIds)
    next.delete(alarmId)
    setResolvedIds(next)

    startTransition(async () => {
      const result = await unresolveAlarm(alarmId)
      if (!result.success) {
        setResolvedIds(prev)
      }
    })
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: headerConfig.bannerBg, border: headerConfig.bannerBorder }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} style={{ color: headerConfig.iconColor }} />
        <span className="text-[12px] font-semibold" style={{ color: headerConfig.iconColor }}>
          {activeCount === 0
            ? 'Все предупреждения выполнены'
            : activeCount === 1
              ? '1 предупреждение'
              : `${activeCount} ${pluralize(activeCount)}`}
        </span>
      </div>

      {visible.map((alarm) => {
        const isResolved = resolvedIds.has(alarm.id)
        const config = SEVERITY_CONFIG[alarm.severity]
        const Icon = isResolved ? Check : config.icon

        return (
          <div
            key={alarm.id}
            className="flex items-start gap-3 p-3 rounded-xl transition-all duration-300"
            style={{
              background: 'var(--apex-surface)',
              border: config.bannerBorder,
              opacity: isResolved ? 0.45 : isPending ? 0.7 : 1,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: isResolved ? 'var(--apex-success-bg)' : config.iconBg }}
            >
              <Icon size={15} style={{ color: isResolved ? 'var(--apex-success-text)' : config.iconColor }} />
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-semibold"
                style={{
                  color: isResolved ? 'var(--apex-text-muted)' : config.titleColor,
                  textDecoration: isResolved ? 'line-through' : 'none',
                }}
              >
                {alarm.title}
              </div>

              {alarm.ws_task_name && (
                <div className="text-[12px] font-medium mt-0.5 flex items-center gap-1">
                  {alarm.ws_task_url ? (
                    <a
                      href={alarm.ws_task_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                      style={{ color: isResolved ? 'var(--apex-text-muted)' : 'var(--apex-text)' }}
                    >
                      {alarm.ws_task_name}
                      <ExternalLink size={11} style={{ color: 'var(--apex-text-muted)' }} />
                    </a>
                  ) : (
                    <span style={{ color: isResolved ? 'var(--apex-text-muted)' : 'var(--apex-text)' }}>
                      {alarm.ws_task_name}
                    </span>
                  )}
                </div>
              )}

              {!isResolved && <AlarmDetails alarm={alarm} />}
            </div>

            {isResolved ? (
              <button
                type="button"
                onClick={() => handleUnresolve(alarm.id)}
                disabled={isPending}
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 border transition-colors hover:bg-[var(--apex-warning-bg)]"
                style={{ borderColor: 'var(--apex-border)' }}
                title="Вернуть в активные"
              >
                <Undo2 size={13} style={{ color: 'var(--apex-text-muted)' }} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleResolve(alarm.id)}
                disabled={isPending}
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 border transition-colors hover:bg-[var(--apex-success-bg)]"
                style={{ borderColor: 'var(--apex-border)' }}
                title="Отметить как выполненное"
              >
                <Check size={14} style={{ color: 'var(--apex-text-muted)' }} />
              </button>
            )}
          </div>
        )
      })}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors hover:opacity-80"
          style={{ color: headerConfig.iconColor }}
        >
          {expanded ? (
            <>
              <ChevronUp size={13} />
              Свернуть
            </>
          ) : (
            <>
              <ChevronDown size={13} />
              Показать все ({sorted.length})
            </>
          )}
        </button>
      )}
    </div>
  )
}

function AlarmDetails({ alarm }: { alarm: Alarm }) {
  const d = alarm.details as Record<string, unknown>
  const budgetPercent = d.budget_percent as number | undefined
  const nextCheckpoint = d.next_checkpoint as number | undefined
  const assigneeName = d.assignee_name as string | undefined

  if (budgetPercent === undefined || nextCheckpoint === undefined) return null

  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      {alarm.alarm_type === 'team_label_change_soon' && assigneeName && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ background: 'var(--tag-teal-bg)', color: 'var(--tag-teal-text)' }}
        >
          {assigneeName}
        </span>
      )}
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: 'var(--apex-warning-muted)', color: 'var(--apex-warning-dark)' }}
      >
        бюджет {budgetPercent}%
      </span>
      <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>→</span>
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-error-text)' }}
      >
        чекпоинт {nextCheckpoint}%
      </span>
    </div>
  )
}

function pluralize(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return 'предупреждений'
  if (mod10 === 1) return 'предупреждение'
  if (mod10 >= 2 && mod10 <= 4) return 'предупреждения'
  return 'предупреждений'
}
