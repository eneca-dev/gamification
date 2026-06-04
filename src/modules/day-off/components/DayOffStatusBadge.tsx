import { Clock, CheckCircle, XCircle } from 'lucide-react'
import type { DayOffStatus } from '../types'

interface DayOffStatusBadgeProps {
  status: DayOffStatus
}

const CONFIG: Record<DayOffStatus, { label: string; Icon: typeof Clock; color: string; bg: string }> = {
  pending:  { label: 'На рассмотрении', Icon: Clock,       color: 'var(--apex-text-secondary)', bg: 'var(--apex-bg)' },
  approved: { label: 'Одобрено',        Icon: CheckCircle, color: 'var(--apex-primary)',         bg: 'var(--apex-success-bg)' },
  rejected: { label: 'Отклонено',       Icon: XCircle,     color: 'var(--apex-danger)',          bg: '#fef2f2' },
}

export function DayOffStatusBadge({ status }: DayOffStatusBadgeProps) {
  const { label, Icon, color, bg } = CONFIG[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
      style={{ color, background: bg }}
    >
      <Icon size={12} />
      {label}
    </span>
  )
}
