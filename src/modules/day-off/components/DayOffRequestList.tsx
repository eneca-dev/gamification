import { CalendarDays } from 'lucide-react'
import { DayOffStatusBadge } from './DayOffStatusBadge'
import { formatDate } from '../utils'
import type { DayOffRequest } from '../types'

interface DayOffRequestListProps {
  requests: DayOffRequest[]
}

export function DayOffRequestList({ requests }: DayOffRequestListProps) {
  if (requests.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <CalendarDays size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--apex-text)' }} />
        <p className="text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
          Заявок пока нет
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
        Мои заявки
      </h3>
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="rounded-2xl p-4"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} style={{ color: 'var(--apex-text-muted)' }} />
                  <span className="text-[14px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                    {formatDate(req.requested_date)}
                  </span>
                </div>
                {req.note && (
                  <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
                    {req.note}
                  </p>
                )}
                {req.status === 'rejected' && req.rejection_reason && (
                  <p className="text-[12px]" style={{ color: 'var(--apex-danger)' }}>
                    Причина отклонения: {req.rejection_reason}
                  </p>
                )}
              </div>
              <DayOffStatusBadge status={req.status} />
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--apex-text-muted)' }}>
              Подано {formatDate(req.created_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
