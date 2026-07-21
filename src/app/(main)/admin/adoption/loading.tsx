function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="h-3 w-32 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      <div className="h-7 w-20 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      <div className="h-2.5 w-24 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
    </div>
  )
}

function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', height }}
    >
      <div className="h-3 w-40 rounded-full animate-pulse mb-4" style={{ background: '#E5E7EB' }} />
      <div className="h-full rounded-xl animate-pulse" style={{ background: '#E5E7EB', maxHeight: height - 52 }} />
    </div>
  )
}

function SkeletonSection({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4">
      <div className="h-4 w-56 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: cards }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonChart height={240} />
    </div>
  )
}

export default function AdoptionLoading() {
  return (
    <div className="space-y-8">
      <SkeletonSection cards={3} />
      <SkeletonSection cards={3} />

      {/* Плагины */}
      <div className="space-y-4">
        <div className="h-4 w-56 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonChart height={240} />
      </div>

      {/* Активность */}
      <div className="space-y-4">
        <div className="h-4 w-48 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  )
}
