export default function GratitudesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-4 w-32 rounded animate-pulse mb-3" style={{ background: '#E5E7EB' }} />
        <div className="h-8 w-52 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-64 rounded animate-pulse mt-2" style={{ background: '#E5E7EB' }} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        ))}
        <div className="ml-auto h-8 w-48 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl animate-pulse shrink-0" style={{ background: '#E5E7EB' }} />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-64 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                <div className="h-4 w-full rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                <div className="h-3 w-32 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
