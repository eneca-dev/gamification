'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Scale, ExternalLink, ChevronDown, ChevronUp, Check, X } from 'lucide-react'

import { updateAppealStatus, appealStatusLabels } from '@/modules/feedback/index.client'
import type { AppealStatus } from '@/modules/feedback/index.client'

import type { CorrectionUserAppeal } from '../types'

interface UserAppealsCardProps {
  appeals: CorrectionUserAppeal[]
  highlightAppealId?: string | null
  onPrefillFromAppeal?: (appeal: CorrectionUserAppeal) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAppealDates(dates: string[] | null): string {
  if (!dates || dates.length === 0) return '—'
  return dates
    .map((d) => {
      const [y, m, dd] = d.split('-')
      return `${dd}.${m}.${y}`
    })
    .join(', ')
}

function StatusBadge({ status }: { status: AppealStatus }) {
  const styleMap: Record<AppealStatus, { bg: string; color: string }> = {
    new: { bg: 'var(--apex-warning-muted)', color: 'var(--apex-warning-dark)' },
    approved: { bg: 'var(--apex-success-bg)', color: 'var(--apex-primary)' },
    rejected: {
      bg: 'color-mix(in srgb, var(--apex-danger) 12%, transparent)',
      color: 'var(--apex-danger)',
    },
  }
  const s = styleMap[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {appealStatusLabels[status]}
    </span>
  )
}

export function UserAppealsCard({ appeals, highlightAppealId, onPrefillFromAppeal }: UserAppealsCardProps) {
  // По умолчанию карточка свёрнута. Разворачивается автоматически только если
  // есть highlightAppealId (переход со страницы обжалований админом).
  const [expanded, setExpanded] = useState(Boolean(highlightAppealId))
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewAction, setReviewAction] = useState<AppealStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const highlightRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (highlightAppealId) {
      setExpanded(true)
      // скролл отложенный, чтобы DOM успел раскрыться
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [highlightAppealId])

  function startReview(id: string, action: AppealStatus) {
    setReviewing(id)
    setReviewAction(action)
    setReviewComment('')
    setError(null)
  }

  function cancelReview() {
    setReviewing(null)
    setReviewAction(null)
    setReviewComment('')
    setError(null)
  }

  function submitReview(id: string) {
    if (!reviewAction) return
    if (reviewAction === 'rejected' && reviewComment.trim().length < 3) {
      setError('Укажите причину отклонения')
      return
    }
    startTransition(async () => {
      const result = await updateAppealStatus(id, reviewAction, reviewComment.trim() || null)
      if (!result.success) {
        setError(result.error)
        return
      }
      cancelReview()
    })
  }

  const counts = {
    new: appeals.filter((a) => a.status === 'new').length,
    approved: appeals.filter((a) => a.status === 'approved').length,
    rejected: appeals.filter((a) => a.status === 'rejected').length,
  }
  const hasAppeals = appeals.length > 0

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-5 py-3.5"
      >
        <Scale size={16} style={{ color: 'var(--apex-warning-dark)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--apex-text)' }}>
          Обжалования от пользователя
        </span>
        <div className="flex items-center gap-1.5 ml-auto text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          <span>всего: <span style={{ color: 'var(--apex-text)', fontWeight: 600 }}>{appeals.length}</span></span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ color: counts.new > 0 ? 'var(--apex-warning-dark)' : undefined }}>
            на рассмотрении: <span style={{ fontWeight: 600 }}>{counts.new}</span>
          </span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ color: counts.approved > 0 ? 'var(--apex-primary)' : undefined }}>
            одобрено: <span style={{ fontWeight: 600 }}>{counts.approved}</span>
          </span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ color: counts.rejected > 0 ? 'var(--apex-danger)' : undefined }}>
            отклонено: <span style={{ fontWeight: 600 }}>{counts.rejected}</span>
          </span>
        </div>
        {expanded
          ? <ChevronUp size={14} style={{ color: 'var(--apex-text-muted)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--apex-text-muted)' }} />}
      </button>

      {expanded && (
        <div className="p-4 flex flex-col gap-3">
          {!hasAppeals ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--apex-text-muted)' }}>
              У пользователя пока нет обжалований
            </p>
          ) : (
            appeals.map((appeal) => {
              const isHighlighted = appeal.id === highlightAppealId
              const isReviewing = reviewing === appeal.id
              return (
                <div
                  key={appeal.id}
                  ref={isHighlighted ? highlightRef : null}
                  className="rounded-xl p-4 transition-all"
                  style={{
                    background: 'var(--apex-bg)',
                    border: `1px solid ${isHighlighted ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                    boxShadow: isHighlighted ? '0 0 0 3px color-mix(in srgb, var(--apex-primary) 20%, transparent)' : 'none',
                  }}
                >
                  {/* Двухколоночный layout: контент слева, скриншоты справа */}
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={appeal.status} />
                          <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }} suppressHydrationWarning>
                            подано: {formatDate(appeal.created_at)}
                          </span>
                          {appeal.status !== 'new' && appeal.reviewed_at && (
                            <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }} suppressHydrationWarning>
                              обработано: {formatDate(appeal.reviewed_at)}
                            </span>
                          )}
                          {appeal.total_coins != null && appeal.total_coins < 0 && (
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
                            >
                              {appeal.total_coins.toLocaleString('ru-RU')} 💎
                            </span>
                          )}
                        </div>
                        {appeal.status === 'new' && !isReviewing && (
                          <div className="flex gap-1.5">
                            {onPrefillFromAppeal && appeal.dates && appeal.dates.length > 0 && (
                              <button
                                type="button"
                                onClick={() => onPrefillFromAppeal(appeal)}
                                className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                                style={{ background: 'var(--apex-primary-bg)', color: 'var(--apex-primary)', border: '1px solid var(--apex-primary)' }}
                              >
                                Заполнить форму
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startReview(appeal.id, 'approved')}
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium"
                              style={{ background: 'var(--apex-primary)', color: '#fff' }}
                            >
                              <Check size={11} />
                              Одобрить
                            </button>
                            <button
                              type="button"
                              onClick={() => startReview(appeal.id, 'rejected')}
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium"
                              style={{ background: 'var(--apex-danger)', color: '#fff' }}
                            >
                              <X size={11} />
                              Отклонить
                            </button>
                          </div>
                        )}
                      </div>

                      {appeal.dates && appeal.dates.length > 0 && (
                        <div className="text-xs">
                          <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>Дни:</span>{' '}
                          <span style={{ color: 'var(--apex-text)' }}>{formatAppealDates(appeal.dates)}</span>
                        </div>
                      )}

                      {appeal.transactions.length > 0 && (
                        <div className="text-xs flex flex-col gap-0.5">
                          <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                            Операции ({appeal.transactions.length}):
                          </span>
                          <ul className="flex flex-col gap-0.5 pl-3">
                            {appeal.transactions.map((tx) => (
                              <li key={tx.id} className="flex items-center justify-between gap-2">
                                <span className="truncate" style={{ color: 'var(--apex-text)' }}>
                                  {tx.description}
                                </span>
                                <span
                                  className="shrink-0 text-[11px] font-semibold"
                                  style={{ color: 'var(--apex-danger)' }}
                                >
                                  {tx.coins.toLocaleString('ru-RU')} 💎
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {appeal.description && (
                        <div className="text-xs" style={{ color: 'var(--apex-text-secondary)' }}>
                          {appeal.description}
                        </div>
                      )}

                      {appeal.task_url && (
                        <a
                          href={appeal.task_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs self-start"
                          style={{ color: 'var(--apex-primary)' }}
                        >
                          Задача
                          <ExternalLink size={10} />
                        </a>
                      )}

                      {appeal.status !== 'new' && appeal.review_comment && (
                        <div
                          className="text-[11px] rounded-lg px-3 py-2"
                          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-secondary)' }}
                        >
                          <span style={{ color: 'var(--apex-text-muted)' }}>Комментарий HR: </span>
                          {appeal.review_comment}
                        </div>
                      )}
                    </div>

                    {/* Скриншоты — справа */}
                    {appeal.image_urls.length > 0 && (
                      <div className="flex flex-col gap-1.5 shrink-0 flex-wrap" style={{ maxWidth: 110 }}>
                        {appeal.image_urls.slice(0, 4).map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity block"
                            style={{ width: 48, height: 48, border: '1px solid var(--apex-border)' }}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                        {appeal.image_urls.length > 4 && (
                          <span className="text-[10px] text-center" style={{ color: 'var(--apex-text-muted)' }}>
                            +{appeal.image_urls.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {isReviewing && (
                    <div className="flex flex-col gap-2 mt-2 pt-3" style={{ borderTop: '1px solid var(--apex-border)' }}>
                      <label className="text-[11px]" style={{ color: 'var(--apex-text-secondary)' }}>
                        {reviewAction === 'approved' ? 'Комментарий (опционально)' : 'Причина отклонения'}
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg px-3 py-2 text-xs border outline-none resize-y"
                        style={{
                          background: 'var(--apex-surface)',
                          borderColor: 'var(--apex-border)',
                          color: 'var(--apex-text)',
                        }}
                        placeholder={reviewAction === 'approved' ? 'Что сделано (например: применена корректировка)' : 'Почему отклонено'}
                      />
                      {error && (
                        <p className="text-[11px]" style={{ color: 'var(--apex-danger)' }}>{error}</p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={cancelReview}
                          disabled={isPending}
                          className="text-[11px] px-3 py-1.5 rounded-full font-medium"
                          style={{ background: 'transparent', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)' }}
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={() => submitReview(appeal.id)}
                          disabled={isPending}
                          className="text-[11px] px-3 py-1.5 rounded-full font-medium"
                          style={{
                            background: reviewAction === 'approved' ? 'var(--apex-primary)' : 'var(--apex-danger)',
                            color: '#fff',
                            opacity: isPending ? 0.6 : 1,
                          }}
                        >
                          {isPending ? 'Сохранение...' : reviewAction === 'approved' ? 'Подтвердить одобрение' : 'Подтвердить отклонение'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
