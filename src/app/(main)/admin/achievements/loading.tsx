export default function AdminAchievementsLoading() {
  return (
    <div className="space-y-6">
      {/* Топ ближайших */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="h-4 w-52 rounded animate-pulse mb-4" style={{ background: '#E5E7EB' }} />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ border: '1px solid var(--border)' }}
            >
              <div className="w-7 h-7 rounded animate-pulse shrink-0" style={{ background: '#E5E7EB' }} />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                <div className="h-1.5 w-full rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
              </div>
              <div className="h-5 w-12 rounded animate-pulse shrink-0" style={{ background: '#E5E7EB' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Поиск */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="h-4 w-44 rounded animate-pulse mb-4" style={{ background: '#E5E7EB' }} />
        <div className="h-10 w-full rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>
    </div>
  )
}
