const CARD_KEYS = Array.from({ length: 12 }, (_, index) => `card-${index}`)

export default function BimoGalleryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-56 rounded-lg" style={{ background: '#E5E7EB' }} />
          <div className="h-4 w-40 rounded" style={{ background: '#E5E7EB' }} />
        </div>
        <div className="h-10 w-48 rounded-xl" style={{ background: '#E5E7EB' }} />
      </div>

      <div className="h-[220px] rounded-2xl" style={{ background: '#E5E7EB' }} />

      <div className="grid grid-cols-3 gap-3">
        {['podium-1', 'podium-2', 'podium-3'].map((key) => (
          <div key={key} className="h-[190px] rounded-2xl" style={{ background: '#E5E7EB' }} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {['filter-1', 'filter-2', 'filter-3'].map((key) => (
          <div key={key} className="h-10 w-32 rounded-xl" style={{ background: '#E5E7EB' }} />
        ))}
      </div>

      <div className="h-12 rounded-xl" style={{ background: '#E5E7EB' }} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {CARD_KEYS.map((key) => (
          <div key={key} className="h-[190px] rounded-2xl" style={{ background: '#E5E7EB' }} />
        ))}
      </div>
    </div>
  )
}
