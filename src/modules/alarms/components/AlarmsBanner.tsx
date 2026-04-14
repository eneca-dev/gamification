'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, Check, ExternalLink, Undo2, CircleCheckBig } from 'lucide-react'
import { resolveAlarm, unresolveAlarm } from '@/modules/alarms/index.client'

import type { Alarm } from '../types'

interface AlarmsBannerProps {
  alarms: Alarm[]
  showAll?: boolean
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 }

const ALARM_TYPE_CONFIG: Record<string, {
  level: string
  badgeBg: string
  badgeColor: string
  badgeBorder: string
  rowBg: string
  rowBorder: string
  actionText: string
}> = {
  label_change_soon: {
    level: 'L3',
    badgeBg: 'var(--teal-100)',
    badgeColor: 'var(--apex-primary)',
    badgeBorder: '1px solid rgba(var(--apex-primary-rgb), 0.2)',
    rowBg: 'rgba(var(--apex-primary-rgb), 0.04)',
    rowBorder: '1px solid rgba(var(--apex-primary-rgb), 0.1)',
    actionText: 'Смените метку',
  },
  team_label_change_soon: {
    level: 'L2',
    badgeBg: 'var(--orange-50)',
    badgeColor: 'var(--orange-500)',
    badgeBorder: '1px solid rgba(var(--orange-500-rgb), 0.2)',
    rowBg: 'rgba(var(--orange-500-rgb), 0.04)',
    rowBorder: '1px solid rgba(var(--orange-500-rgb), 0.1)',
    actionText: 'Проверьте метку L3',
  },
}

const DEFAULT_TYPE_CONFIG = ALARM_TYPE_CONFIG['label_change_soon']

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
        <div className="flex items-center gap-2 px-1 py-[7px] shrink-0 mb-4">
          <Bell size={16} style={{ color: 'var(--apex-warning-text)' }} fill="var(--apex-warning-text)" />
          <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Напоминания
          </span>
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
          {/* Шапка */}
          <div className="flex items-center justify-between px-1 min-h-[36px] shrink-0">
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
        const config = ALARM_TYPE_CONFIG[alarm.alarm_type] ?? DEFAULT_TYPE_CONFIG
        const d = alarm.details as Record<string, unknown>
        const budgetPercent = d.budget_percent as number | undefined
        const nextCheckpoint = d.next_checkpoint as number | undefined
        const assigneeName = d.assignee_name as string | undefined

        return (
          <div
            key={alarm.id}
            className={`flex flex-col gap-1 px-2.5 rounded-lg transition-all duration-300 ${showAll ? 'py-1.5' : 'py-2.5'}`}
            style={{
              background: isResolved ? RESOLVED_STYLE.bg : config.rowBg,
              border: isResolved ? RESOLVED_STYLE.border : config.rowBorder,
              opacity: isResolved ? 0.55 : pendingIds.has(alarm.id) ? 0.7 : 1,
            }}
          >
            {/* Первая строка: бейдж + действие + имя + проценты + кнопка */}
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                style={{
                  background: isResolved ? RESOLVED_STYLE.pillBg : config.badgeBg,
                  color: isResolved ? RESOLVED_STYLE.pillColor : config.badgeColor,
                  border: isResolved ? RESOLVED_STYLE.border : config.badgeBorder,
                }}
              >
                {config.level}
              </span>

              <span
                className="text-[11px] font-semibold shrink-0"
                style={{
                  color: isResolved ? 'var(--apex-text-muted)' : config.badgeColor,
                  textDecoration: isResolved ? 'line-through' : 'none',
                }}
              >
                {config.actionText}
              </span>

              {alarm.alarm_type === 'team_label_change_soon' && assigneeName && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                  style={{
                    background: isResolved ? RESOLVED_STYLE.pillBg : 'var(--tag-teal-bg)',
                    color: isResolved ? RESOLVED_STYLE.pillColor : 'var(--tag-teal-text)',
                  }}
                >
                  {assigneeName}
                </span>
              )}

              {budgetPercent !== undefined && nextCheckpoint !== undefined && (
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-default"
                    title="Текущий расход бюджета задачи"
                    style={{
                      background: isResolved ? RESOLVED_STYLE.pillBg : 'var(--apex-warning-muted)',
                      color: isResolved ? RESOLVED_STYLE.pillColor : 'var(--apex-warning-dark)',
                    }}
                  >
                    {budgetPercent}%
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>→</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-default"
                    title="Ближайший чекпоинт — нужно сменить метку до его достижения"
                    style={{
                      background: isResolved ? RESOLVED_STYLE.pillBg : 'var(--apex-error-bg)',
                      color: isResolved ? RESOLVED_STYLE.pillColor : 'var(--apex-error-text)',
                    }}
                  >
                    {nextCheckpoint}%
                  </span>
                </div>
              )}

            </div>

            {/* Вторая строка: название задачи + кнопка */}
            <div className="flex items-end gap-2 pl-[30px]">
              <div className="flex-1 min-w-0">
                {alarm.ws_task_name && (
                  alarm.ws_task_url ? (
                    <a
                      href={alarm.ws_task_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-[11px] inline items-start gap-1 ${isResolved ? 'line-through' : 'hover:underline'}`}
                      style={{ color: isResolved ? 'var(--apex-text-muted)' : 'var(--apex-text)' }}
                    >
                      <span className="break-words">{alarm.ws_task_name}</span>
                      {' '}
                      <ExternalLink size={9} className="inline shrink-0" style={{ marginTop: '-2px' }} />
                    </a>
                  ) : (
                    <span
                      className="text-[11px] break-words"
                      style={{
                        color: isResolved ? 'var(--apex-text-muted)' : 'var(--apex-text)',
                        textDecoration: isResolved ? 'line-through' : 'none',
                      }}
                    >
                      {alarm.ws_task_name}
                    </span>
                  )
                )}
              </div>

              {isResolved ? (
                <button
                  type="button"
                  onClick={() => handleUnresolve(alarm.id)}
                  disabled={pendingIds.has(alarm.id)}
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors hover:bg-[var(--apex-warning-bg)]"
                  style={{ borderColor: 'var(--apex-border)' }}
                  title="Вернуть в активные"
                >
                  <Undo2 size={11} style={{ color: 'var(--apex-text-muted)' }} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleResolve(alarm.id)}
                  disabled={pendingIds.has(alarm.id)}
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors hover:bg-[var(--apex-success-bg)]"
                  style={{ borderColor: 'var(--apex-border)' }}
                  title="Отметить как выполненное"
                >
                  <Check size={12} style={{ color: 'var(--apex-text-muted)' }} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      </div>

    </div>
  )
}


