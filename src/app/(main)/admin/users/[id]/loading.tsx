export default function UserDetailLoading() {
  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Back link skeleton */}
      <div
        className="h-4 w-32 rounded-full animate-pulse"
        style={{ background: '#E5E7EB' }}
      />

      {/* Header card skeleton */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
        }}
      >
        <div
          className="h-6 w-48 rounded-full animate-pulse"
          style={{ background: '#E5E7EB' }}
        />
        <div
          className="h-3.5 w-56 rounded-full animate-pulse mt-2"
          style={{ background: '#E5E7EB' }}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl px-4 py-3"
              style={{ background: 'var(--apex-bg)' }}
            >
              <div
                className="h-3 w-12 rounded-full animate-pulse mb-2"
                style={{ background: '#E5E7EB' }}
              />
              <div
                className="h-4 w-20 rounded-full animate-pulse"
                style={{ background: '#E5E7EB' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Transactions skeleton */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
        }}
      >
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--apex-border)' }}
        >
          <div
            className="h-4 w-44 rounded-full animate-pulse"
            style={{ background: '#E5E7EB' }}
          />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid var(--apex-border)' }}
          >
            <div className="space-y-1.5">
              <div
                className="h-3.5 rounded-full animate-pulse"
                style={{ background: '#E5E7EB', width: `${140 + (i % 3) * 40}px` }}
              />
              <div
                className="h-3 w-24 rounded-full animate-pulse"
                style={{ background: '#E5E7EB' }}
              />
            </div>
            <div
              className="h-4 w-16 rounded-full animate-pulse"
              style={{ background: '#E5E7EB' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
