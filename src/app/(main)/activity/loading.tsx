export default function ActivityLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-64 rounded-lg animate-pulse mt-2" style={{ background: '#E5E7EB' }} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
              <div>
                <div className="h-6 w-10 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                <div className="h-3 w-32 rounded animate-pulse mt-1" style={{ background: '#E5E7EB' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Achievements section */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-48 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-6 w-28 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl p-4 space-y-3" style={{ border: '1px solid var(--border)' }}>
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

      {/* Gratitudes section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-52 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-6 w-32 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
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
    </div>
  )
}
