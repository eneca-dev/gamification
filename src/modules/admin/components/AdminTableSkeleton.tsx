interface AdminTableSkeletonProps {
  rows?: number
  columns?: number
}

export function AdminTableSkeleton({
  rows = 8,
  columns = 4,
}: AdminTableSkeletonProps) {
  // Разная ширина строк для реалистичности
  const widths = ['60%', '80%', '45%', '70%', '55%', '40%', '75%', '50%']

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex gap-4 px-5 py-3"
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-full animate-pulse"
            style={{
              background: '#E5E7EB',
              width: i === 0 ? '120px' : i === columns - 1 ? '60px' : '80px',
            }}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--apex-border)' }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-3 rounded-full animate-pulse"
              style={{
                background: '#E5E7EB',
                width:
                  colIdx === 0
                    ? '140px'
                    : widths[(rowIdx + colIdx) % widths.length],
              }}
            />
          ))}
        </div>
      ))}

      {/* Footer */}
      <div className="px-5 py-3">
        <div
          className="h-2.5 w-24 rounded-full animate-pulse"
          style={{ background: '#E5E7EB' }}
        />
      </div>
    </div>
  )
}
