'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bell, Clock, Info, Check, ExternalLink, Undo2, CircleCheckBig } from 'lucide-react'
import { resolveAlarm, unresolveAlarm } from '@/modules/alarms/index.client'

import type { Alarm, AlarmSeverity } from '../types'

interface AlarmsBannerProps {
  alarms: Alarm[]
  showAll?: boolean
}

const SEVERITY_ORDER: Record<AlarmSeverity, number> = { critical: 0, warning: 1, info: 2 }

const SEVERITY_CONFIG: Record<AlarmSeverity, {
  bg: string
  border: string
  iconBg: string
  iconColor: string
  titleColor: string
  icon: typeof AlertTriangle
}> = {
  critical: {
    bg: 'var(--apex-error-bg)',
    border: '1px solid rgba(220, 38, 38, 0.2)',
    iconBg: 'var(--apex-error-bg)',
    iconColor: 'var(--apex-error-text)',
    titleColor: 'var(--apex-error-text)',
    icon: AlertTriangle,
  },
  warning: {
    bg: 'var(--apex-warning-bg)',
    border: '1px solid rgba(217, 119, 6, 0.2)',
    iconBg: 'var(--apex-warning-bg)',
    iconColor: 'var(--apex-warning-text)',
    titleColor: 'var(--apex-warning-dark)',
    icon: Clock,
  },
  info: {
    bg: 'var(--apex-info-bg)',
    border: '1px solid rgba(37, 99, 235, 0.2)',
    iconBg: 'var(--apex-info-bg)',
    iconColor: 'var(--apex-info-text)',
    titleColor: 'var(--apex-info-text)',
    icon: Info,
  },
}

const RESOLVED_STYLE = {
  bg: 'var(--apex-surface)',
  border: '1px solid var(--apex-border)',
  iconBg: 'var(--apex-surface)',
  pillBg: 'var(--apex-surface)',
  pillColor: 'var(--apex-text-muted)',
}

const COLLAPSE_THRESHOLD = 3

export function AlarmsBanner({ alarms: initialAlarms, showAll = false }: AlarmsBannerProps) {
  const serverResolvedIds = new Set(initialAlarms.filter((a) => a.is_resolved).map((a) => a.id))
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(serverResolvedIds)
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const [, startTransition] = useTransition()

  const isAlarmResolved = (id: number) => resolvedIds.has(id)

  const active = initialAlarms
    .filter((a) => !isAlarmResolved(a.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const resolved = initialAlarms
    .filter((a) => isAlarmResolved(a.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const sorted = [...active, ...resolved]

  const visible = showAll || sorted.length <= COLLAPSE_THRESHOLD ? sorted : sorted.slice(0, COLLAPSE_THRESHOLD)

  function handleResolve(alarmId: number) {
    const prevResolved = new Set(resolvedIds)
    setResolvedIds(new Set([...resolvedIds, alarmId]))
    setPendingIds((p) => new Set([...p, alarmId]))

    startTransition(async () => {
      const result = await resolveAlarm(alarmId)
      if (!result.success) setResolvedIds(prevResolved)
      setPendingIds((p) => { const n = new Set(p); n.delete(alarmId); return n })
    })
  }

  function handleUnresolve(alarmId: number) {
    const prevResolved = new Set(resolvedIds)
    const nextResolved = new Set(resolvedIds)
    nextResolved.delete(alarmId)
    setResolvedIds(nextResolved)
    setPendingIds((p) => new Set([...p, alarmId]))

    startTransition(async () => {
      const result = await unresolveAlarm(alarmId)
      if (!result.success) setResolvedIds(prevResolved)
      setPendingIds((p) => { const n = new Set(p); n.delete(alarmId); return n })
    })
  }

  if (initialAlarms.length === 0) {
    return (
      <div
        className="rounded-2xl p-4 h-full flex flex-col"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="text-[12px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--apex-text-muted)' }}>
          Напоминания
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'var(--apex-success-bg)' }}
          >
            <CircleCheckBig size={28} style={{ color: 'var(--apex-success-text)' }} />
          </div>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
            Нет напоминаний на сегодня
          </span>
          <span className="text-[11px] mt-1" style={{ color: 'var(--apex-text-muted)' }}>
            Все задачи в порядке
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl p-4 flex flex-col ${showAll ? 'space-y-3' : 'h-full'}`}
      style={showAll ? undefined : { background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      {!showAll && (
        <>
          {/* Шапка — аналог шапки благодарностей по высоте */}
          <div className="flex items-center justify-between px-1 py-[7px] shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={16} style={{ color: 'var(--apex-warning-text)' }} fill="var(--apex-warning-text)" />
              <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                Напоминания
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--apex-text-muted)' }}>
                {resolved.length}/{initialAlarms.length}
              </span>
            </div>
          </div>
          {/* Подзаголовок с ссылкой */}
          <div className="flex items-center justify-between shrink-0 mt-[10px]">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--apex-text-muted)' }}>
              Напоминания на сегодня
            </div>
            <Link href="/alarms" className="text-[12px] font-semibold" style={{ color: 'var(--apex-primary)' }}>
              Все напоминания →
            </Link>
          </div>
        </>
      )}

      <div className={`space-y-2 ${showAll ? '' : 'flex-1 flex flex-col justify-end mt-1'}`}>
      {visible.map((alarm) => {
        const isResolved = resolvedIds.has(alarm.id)
        const config = SEVERITY_CONFIG[alarm.severity]
        const Icon = isResolved ? Check : config.icon

        return (
          <div
            key={alarm.id}
            className="flex items-start gap-3 p-3 rounded-xl transition-all duration-300"
            style={{
              background: isResolved ? RESOLVED_STYLE.bg : config.bg,
              border: isResolved ? RESOLVED_STYLE.border : config.border,
              opacity: isResolved ? 0.55 : pendingIds.has(alarm.id) ? 0.7 : 1,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: isResolved ? RESOLVED_STYLE.iconBg : config.iconBg }}
            >
              <Icon size={15} style={{ color: isResolved ? 'var(--apex-text-muted)' : config.iconColor }} />
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
                      style={{
                        color: isResolved ? 'var(--apex-text-muted)' : 'var(--apex-text)',
                        textDecoration: isResolved ? 'line-through' : 'none',
                      }}
                    >
                      {alarm.ws_task_name}
                      {!isResolved && <ExternalLink size={11} style={{ color: 'var(--apex-text-muted)' }} />}
                    </a>
                  ) : (
                    <span style={{
                      color: isResolved ? 'var(--apex-text-muted)' : 'var(--apex-text)',
                      textDecoration: isResolved ? 'line-through' : 'none',
                    }}>
                      {alarm.ws_task_name}
                    </span>
                  )}
                </div>
              )}

              <AlarmDetails alarm={alarm} isResolved={isResolved} />
            </div>

            {isResolved ? (
              <button
                type="button"
                onClick={() => handleUnresolve(alarm.id)}
                disabled={pendingIds.has(alarm.id)}
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
                disabled={pendingIds.has(alarm.id)}
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
      </div>

    </div>
  )
}

function AlarmDetails({ alarm, isResolved }: { alarm: Alarm; isResolved: boolean }) {
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
          style={{
            background: isResolved ? RESOLVED_STYLE.pillBg : 'var(--tag-teal-bg)',
            color: isResolved ? RESOLVED_STYLE.pillColor : 'var(--tag-teal-text)',
          }}
        >
          {assigneeName}
        </span>
      )}
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{
          background: isResolved ? RESOLVED_STYLE.pillBg : 'var(--apex-warning-muted)',
          color: isResolved ? RESOLVED_STYLE.pillColor : 'var(--apex-warning-dark)',
        }}
      >
        бюджет {budgetPercent}%
      </span>
      <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>→</span>
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{
          background: isResolved ? RESOLVED_STYLE.pillBg : 'var(--apex-error-bg)',
          color: isResolved ? RESOLVED_STYLE.pillColor : 'var(--apex-error-text)',
        }}
      >
        чекпоинт {nextCheckpoint}%
      </span>
    </div>
  )
}

