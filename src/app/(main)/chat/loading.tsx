export default function ChatLoading() {
  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="mb-4 shrink-0">
        <div className="h-7 w-36 rounded-lg animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-64 rounded animate-pulse mt-1.5" style={{ background: '#E5E7EB' }} />
      </div>

      <div
        className="flex-1 rounded-2xl overflow-hidden min-h-0 flex flex-col"
        style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
      >
        <div className="flex-1 px-4 py-4 space-y-3">
          {[120, 200, 80, 160, 240].map((width, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div
                className="h-9 rounded-2xl animate-pulse"
                style={{ width, background: '#E5E7EB' }}
              />
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 pt-2">
          <div className="h-12 rounded-2xl animate-pulse" style={{ background: '#E5E7EB' }} />
        </div>
      </div>
    </div>
  )
}
