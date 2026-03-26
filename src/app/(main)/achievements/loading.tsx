export default function AchievementsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-72 rounded-lg animate-pulse mt-2" style={{ background: '#E5E7EB' }} />
      </div>

      {/* Progress cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="h-4 w-24 rounded animate-pulse mb-4" style={{ background: '#E5E7EB' }} />
            <div className="space-y-4">
              <div>
                <div className="h-3 w-full rounded animate-pulse mb-2" style={{ background: '#E5E7EB' }} />
                <div className="h-2 w-full rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ranking tables skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="h-5 w-40 rounded-lg animate-pulse mb-4" style={{ background: '#E5E7EB' }} />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-6 h-6 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
                  <div className="flex-1">
                    <div className="h-3 w-32 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                  </div>
                  <div className="h-4 w-12 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
