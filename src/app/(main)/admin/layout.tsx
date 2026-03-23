import { AdminNav } from '@/modules/admin/components/AdminNav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="animate-fade-in-up">
        <h1
          className="text-[20px] font-bold"
          style={{ color: 'var(--apex-text)' }}
        >
          Админ-панель
        </h1>
        <p
          className="text-[13px] font-medium mt-1"
          style={{ color: 'var(--apex-text-secondary)' }}
        >
          Управление системой геймификации
        </p>
      </div>

      <AdminNav />

      <div className="animate-fade-in-up stagger-1">{children}</div>
    </div>
  )
}
