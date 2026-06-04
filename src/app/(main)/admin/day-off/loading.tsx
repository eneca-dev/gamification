export default function AdminDayOffLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="h-5 w-48 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-64 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
          >
            <div className="flex justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-36 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                <div className="h-3 w-48 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
              </div>
              <div className="h-6 w-28 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-24 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
              <div className="h-8 w-24 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
