export default function AdminCalendarLoading() {
  return (
    <div className="space-y-5">
      {/* Легенда скелетон */}
      <div
        className="rounded-xl px-5 py-3"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
        }}
      >
        <div className="h-4 w-64 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>

      {/* Сетка месяцев */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 13 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden"
            style={{
              background: 'var(--apex-surface)',
              border: '1px solid var(--apex-border)',
            }}
          >
            {/* Заголовок */}
            <div
              className="px-3 py-2 flex justify-center"
              style={{ borderBottom: '1px solid var(--apex-border)' }}
            >
              <div className="h-4 w-24 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
            </div>
            {/* Сетка */}
            <div className="px-2 py-2 space-y-1">
              {Array.from({ length: 6 }).map((_, r) => (
                <div key={r} className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: 7 }).map((_, c) => (
                    <div
                      key={c}
                      className="aspect-square rounded-md animate-pulse"
                      style={{ background: '#E5E7EB', opacity: r === 5 && c > 2 ? 0 : 0.4 + Math.random() * 0.3 }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
