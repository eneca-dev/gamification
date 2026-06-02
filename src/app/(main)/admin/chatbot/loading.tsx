export default function AdminChatbotLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-48 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="h-3.5 w-24 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
        </div>
        <div className="h-9 w-32 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>

      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)' }}>
            <div className="h-4 w-4 rounded animate-pulse" style={{ background: '#E5E7EB', flexShrink: 0 }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
              <div className="h-3 w-32 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
            </div>
            <div className="h-7 w-24 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
          <div className="px-4 py-3 space-y-2" style={{ background: 'var(--surface)' }}>
            {[1, 2].map((j) => (
              <div key={j} className="h-4 rounded-lg animate-pulse" style={{ background: '#E5E7EB', width: `${70 + j * 10}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
