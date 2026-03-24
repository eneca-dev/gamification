export default function StoreLoading() {
  return (
    <div className="space-y-6">
      {/* Заголовок + баланс */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-[#E5E7EB] animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-[#E5E7EB] animate-pulse" />
        </div>
        <div className="h-14 w-32 rounded-xl bg-[#E5E7EB] animate-pulse" />
      </div>

      {/* Фильтры */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-[#E5E7EB] animate-pulse" />
        ))}
      </div>

      {/* Грид карточек */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="h-36 bg-[#E5E7EB] animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-3 w-16 rounded bg-[#E5E7EB] animate-pulse" />
              <div className="h-4 w-full rounded bg-[#E5E7EB] animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-[#E5E7EB] animate-pulse" />
              <div className="h-5 w-20 rounded bg-[#E5E7EB] animate-pulse" />
              <div className="h-10 w-full rounded-xl bg-[#E5E7EB] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
