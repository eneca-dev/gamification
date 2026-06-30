'use client'

import { useTransition, useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, ZoomIn } from 'lucide-react'
import { approveDayOffRequest, rejectDayOffRequest } from '@/modules/day-off/index.client'
import { DayOffStatusBadge } from './DayOffStatusBadge'
import { ImageLightbox } from '@/components/ImageLightbox'
import { formatDate } from '@/modules/day-off/utils'
import { REQUEST_TYPE_LABELS } from '@/modules/day-off/index.client'
import type { DayOffRequestAdmin } from '@/modules/day-off/index.client'

interface AdminDayOffListProps {
  requests: DayOffRequestAdmin[]
  screenshotUrls: Record<string, string>
}

function RequestRow({
  req,
  screenshotUrl,
  onViewScreenshot,
}: {
  req: DayOffRequestAdmin
  screenshotUrl: string | undefined
  onViewScreenshot: (url: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Optimistic: мгновенно отражаем новый статус до ответа сервера
  const [optimisticStatus, setOptimisticStatus] = useState(req.status)
  const [optimisticRejectionReason, setOptimisticRejectionReason] = useState(req.rejection_reason)

  const isActive = optimisticStatus === 'pending'
  const isBusinessTrip = req.request_type === 'business_trip'

  function handleApprove() {
    setError(null)
    const prev = optimisticStatus
    setOptimisticStatus('approved')
    startTransition(async () => {
      const result = await approveDayOffRequest(req.id)
      if (!result.success) {
        setOptimisticStatus(prev)
        setError(result.error)
      }
    })
  }

  function handleReject() {
    if (!showRejectInput) { setShowRejectInput(true); return }
    setError(null)
    const prev = optimisticStatus
    const prevReason = optimisticRejectionReason
    setOptimisticStatus('rejected')
    setOptimisticRejectionReason(rejectReason || null)
    startTransition(async () => {
      const result = await rejectDayOffRequest({ id: req.id, rejection_reason: rejectReason || undefined })
      if (!result.success) {
        setOptimisticStatus(prev)
        setOptimisticRejectionReason(prevReason)
        setError(result.error)
      } else {
        setShowRejectInput(false)
      }
    })
  }

  return (
    <div
      data-onboarding="admin-day-off-row"
      className="rounded-xl p-3 space-y-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      {/* Основная строка */}
      <div className="flex items-stretch gap-3">
        {/* Инфо + кнопки */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                {req.user_name}
              </span>
              <span className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
                {formatDate(req.requested_date)}
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md text-[11px] font-medium"
                style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)', border: '1px solid var(--apex-border)' }}
              >
                {REQUEST_TYPE_LABELS[req.request_type]}
              </span>
              {req.note && (
                <span className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
                  · {req.note}
                </span>
              )}
            </div>
            {optimisticStatus === 'rejected' && (
              <>
                {optimisticRejectionReason && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--apex-danger)' }}>
                    Причина: {optimisticRejectionReason}
                  </p>
                )}
                {req.rejected_by_name && (
                  <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                    Отклонил: {req.rejected_by_name}
                  </p>
                )}
              </>
            )}
            {optimisticStatus === 'approved' && req.approved_by_name && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--apex-text-muted)' }}>
                Одобрил: {req.approved_by_name}
              </p>
            )}
          </div>

          {isActive && (
            <div data-onboarding="admin-day-off-actions" className="flex items-center gap-2 flex-wrap mt-auto">
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={{
                  background: isPending ? 'var(--apex-disabled-bg)' : 'var(--apex-success-bg)',
                  color: isPending ? 'var(--apex-text-muted)' : 'var(--apex-primary)',
                  border: '1px solid var(--apex-border)',
                }}
              >
                <CheckCircle size={12} />
                Одобрить
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={{
                  background: isPending ? 'var(--apex-disabled-bg)' : 'var(--apex-error-bg)',
                  color: isPending ? 'var(--apex-text-muted)' : 'var(--apex-danger)',
                  border: '1px solid var(--apex-border)',
                }}
              >
                <XCircle size={12} />
                {showRejectInput ? 'Подтвердить' : 'Отклонить'}
              </button>
              {showRejectInput && (
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="px-2 py-1.5 rounded-lg text-[12px]"
                  style={{ color: 'var(--apex-text-muted)' }}
                >
                  Отмена
                </button>
              )}
            </div>
          )}

          {isActive && showRejectInput && (
            <input
              type="text"
              placeholder="Причина отклонения (необязательно)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-[12px]"
              style={{
                background: 'var(--apex-bg)',
                border: '1px solid var(--apex-border)',
                color: 'var(--apex-text)',
                outline: 'none',
              }}
            />
          )}
        </div>

        {/* Статус + скрин */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <DayOffStatusBadge status={optimisticStatus} />
          {!isBusinessTrip && screenshotUrl && (
            <button
              type="button"
              onClick={() => onViewScreenshot(screenshotUrl)}
              data-onboarding="admin-day-off-screenshot"
              className="relative group overflow-hidden flex-shrink-0"
              style={{ width: 72, height: 48, borderRadius: '8px', border: '1px solid var(--apex-border)' }}
            >
              <img src={screenshotUrl} alt="Скриншот" className="w-full h-full object-cover" />
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              >
                <ZoomIn size={14} color="#fff" />
              </div>
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[12px]" style={{ color: 'var(--apex-danger)' }}>{error}</p>
      )}
    </div>
  )
}

export function AdminDayOffList({ requests, screenshotUrls }: AdminDayOffListProps) {
  const [showResolved, setShowResolved] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const active   = requests.filter((r) => r.status === 'pending')
  const resolved = requests.filter((r) => r.status === 'approved' || r.status === 'rejected')

  if (requests.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <p className="text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
          Заявок пока нет
        </p>
      </div>
    )
  }

  return (
    <>
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} alt="Скриншот согласования" onClose={() => setLightboxUrl(null)} />
      )}

      <div className="space-y-4">
        {active.length > 0 && (
          <div data-onboarding="admin-day-off-list" className="space-y-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--apex-text-muted)' }}>
              На рассмотрении ({active.length})
            </h3>
            {active.map((req) => (
              <RequestRow
                key={req.id}
                req={req}
                screenshotUrl={screenshotUrls[req.id]}
                onViewScreenshot={setLightboxUrl}
              />
            ))}
          </div>
        )}

        {resolved.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] font-semibold"
              style={{ color: 'var(--apex-text-secondary)' }}
            >
              {showResolved ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Завершённые ({resolved.length})
            </button>
            {showResolved && resolved.map((req) => (
              <RequestRow
                key={req.id}
                req={req}
                screenshotUrl={screenshotUrls[req.id]}
                onViewScreenshot={setLightboxUrl}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
