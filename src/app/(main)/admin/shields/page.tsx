import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getShieldLog } from '@/modules/streak-shield'
import { Shield } from 'lucide-react'

const typeLabels: Record<string, string> = {
  ws: 'Дисциплина (WS)',
  revit: 'Автоматизация (Revit)',
}

export default async function AdminShieldsPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const log = await getShieldLog()

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center gap-2 mb-4" data-onboarding="admin-shields-header">
        <Shield size={16} style={{ color: 'var(--apex-primary)' }} />
        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          Использования второй жизни
        </h2>
        <span
          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)' }}
        >
          {log.length}
        </span>
      </div>

      {log.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
          Пока никто не использовал вторую жизнь
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" data-onboarding="admin-shields-table">
            <thead>
              <tr style={{ color: 'var(--apex-text-muted)' }}>
                <th className="text-left font-medium pb-3 pr-4">Пользователь</th>
                <th className="text-left font-medium pb-3 pr-4">Тип</th>
                <th className="text-left font-medium pb-3 pr-4">Защищённая дата</th>
                <th className="text-left font-medium pb-3">Дата покупки</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, index) => (
                <tr
                  key={entry.id}
                  className="border-t"
                  style={{ borderColor: 'var(--apex-border)' }}
                  data-onboarding={index === 0 ? 'admin-shields-row' : undefined}
                >
                  <td className="py-2.5 pr-4">
                    <div className="font-medium" style={{ color: 'var(--apex-text)' }}>
                      {entry.userName}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                      {entry.userEmail}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background: entry.shieldType === 'ws' ? 'var(--apex-success-bg)' : 'var(--orange-50)',
                        color: entry.shieldType === 'ws' ? 'var(--apex-primary)' : 'var(--tag-orange-text)',
                      }}
                    >
                      {typeLabels[entry.shieldType] ?? entry.shieldType}
                    </span>
                  </td>
                  <td
                    className="py-2.5 pr-4"
                    style={{ color: 'var(--apex-text)' }}
                    data-onboarding={index === 0 ? 'admin-shields-protected-date' : undefined}
                  >
                    {entry.protectedDate}
                  </td>
                  <td className="py-2.5" style={{ color: 'var(--apex-text-secondary)' }}>
                    {new Date(entry.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
