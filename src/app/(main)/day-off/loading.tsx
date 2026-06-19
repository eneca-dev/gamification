export default function DayOffLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-72 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
          <div className="h-5 w-40 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-4 w-full rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-16 w-full rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-4 w-full rounded animate-pulse" style={{ background: '#E5E7EB' }} />
        </div>
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
          <div className="h-5 w-32 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="h-10 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
          <div className="h-16 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-12 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-10 rounded-xl animate-pulse" style={{ background: '#E5E7EB' }} />
        </div>
      </div>
    </div>
  )
}
