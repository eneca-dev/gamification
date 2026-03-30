export default function AchievementsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-4 w-32 rounded animate-pulse mb-3" style={{ background: '#E5E7EB' }} />
        <div className="h-8 w-56 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-72 rounded animate-pulse mt-2" style={{ background: '#E5E7EB' }} />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-24 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
              <div className="h-5 w-16 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
            </div>
            <div className="h-5 w-36 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="h-4 w-28 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
