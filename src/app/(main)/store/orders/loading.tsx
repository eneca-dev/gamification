export default function StoreOrdersLoading() {
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-lg bg-[#E5E7EB] animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-[#E5E7EB] animate-pulse" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-[#E5E7EB] animate-pulse" />
      </div>

      {/* Фильтры */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-[#E5E7EB] animate-pulse" />
        ))}
      </div>

      {/* Карточки заказов */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="w-12 h-12 rounded-xl bg-[#E5E7EB] animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-48 rounded bg-[#E5E7EB] animate-pulse" />
                <div className="h-5 w-20 rounded-md bg-[#E5E7EB] animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-24 rounded bg-[#E5E7EB] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[#E5E7EB] animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
