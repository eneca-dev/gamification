import { BarChart3 } from 'lucide-react'

export default function AdminPage() {
  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center py-20 gap-3"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      <BarChart3
        size={40}
        strokeWidth={1.5}
        style={{ color: 'var(--apex-text-muted)' }}
      />
      <p
        className="text-[14px] font-medium"
        style={{ color: 'var(--apex-text-secondary)' }}
      >
        Выберите раздел в навигации
      </p>
    </div>
  )
}
