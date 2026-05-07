export default function EconomyLoading() {
  return (
    <div className="space-y-5">
      {/* Фильтры */}
      <div
        className="rounded-2xl p-4 flex flex-wrap items-center gap-3"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`p-${i}`}
            className="h-6 w-20 rounded-full animate-pulse"
            style={{ background: '#E5E7EB' }}
          />
        ))}
        <div className="h-6 w-px" style={{ background: 'var(--apex-border)' }} />
        <div className="h-6 w-44 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-6 w-px" style={{ background: 'var(--apex-border)' }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`l-${i}`}
            className="h-6 w-24 rounded-full animate-pulse"
            style={{ background: '#E5E7EB' }}
          />
        ))}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
          >
            <div className="h-3 w-32 rounded-full animate-pulse mb-3" style={{ background: '#E5E7EB' }} />
            <div className="h-7 w-24 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
        ))}
      </div>

      {/* Категории */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`cat-${i}`}
            className="px-4 py-3"
            style={{ borderBottom: i < 3 ? '1px solid var(--apex-border)' : 'none' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 w-32 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
              <div className="h-3 w-20 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
            </div>
            <div className="h-1.5 w-full rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
