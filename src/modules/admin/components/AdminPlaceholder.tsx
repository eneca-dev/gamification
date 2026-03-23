import type { LucideIcon } from 'lucide-react'

interface AdminPlaceholderProps {
  icon: LucideIcon
  title: string
  description: string
}

export function AdminPlaceholder({
  icon: Icon,
  title,
  description,
}: AdminPlaceholderProps) {
  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      <Icon
        size={40}
        strokeWidth={1.5}
        style={{ color: 'var(--apex-border)' }}
      />
      <div className="text-center">
        <p
          className="text-[15px] font-semibold"
          style={{ color: 'var(--apex-text)' }}
        >
          {title}
        </p>
        <p
          className="text-[13px] font-medium mt-0.5"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          {description}
        </p>
      </div>
    </div>
  )
}
