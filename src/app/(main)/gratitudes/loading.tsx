export default function GratitudesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-4 w-72 rounded-lg animate-pulse mt-2" style={{ background: '#E5E7EB' }} />
        </div>
        <div className="h-10 w-40 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-32 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
              <div className="flex-1">
                <div className="h-4 w-48 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                <div className="h-3 w-full rounded animate-pulse mt-2" style={{ background: '#E5E7EB' }} />
                <div className="h-3 w-24 rounded animate-pulse mt-2" style={{ background: '#E5E7EB' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
