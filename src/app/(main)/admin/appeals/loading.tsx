export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2">
        <div className="h-5 w-56 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-3 w-96 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        ))}
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid gap-3 items-start px-5 py-4"
            style={{
              gridTemplateColumns: '110px 1fr 180px 140px 110px 110px 100px',
              borderBottom: '1px solid var(--apex-border)',
            }}
          >
            <div className="h-5 w-20 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="space-y-1.5">
              <div className="h-3 w-40 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
              <div className="h-2.5 w-32 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
            </div>
            <div className="h-3 w-32 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="h-3 w-28 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="h-3 w-16 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="h-3 w-20 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="h-8 w-8 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
