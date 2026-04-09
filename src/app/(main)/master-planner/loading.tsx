export default function MasterPlannerLoading() {
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
      >
        {/* Шапка */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl animate-pulse" style={{ background: "#E5E7EB" }} />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded-lg animate-pulse" style={{ background: "#E5E7EB" }} />
            <div className="h-3 w-32 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
          </div>
        </div>

        {/* Табы */}
        <div className="flex gap-1 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-14 rounded-lg animate-pulse" style={{ background: "#E5E7EB" }} />
          ))}
        </div>

        {/* Строки таблицы */}
        <div className="space-y-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
              <div className="w-8 h-8 rounded-lg animate-pulse flex-shrink-0" style={{ background: "#E5E7EB" }} />
              <div className="h-4 w-8 rounded animate-pulse flex-shrink-0" style={{ background: "#E5E7EB" }} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3.5 w-2/3 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
                <div className="h-3 w-1/4 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
              </div>
              <div className="h-4 w-10 rounded animate-pulse flex-shrink-0" style={{ background: "#E5E7EB" }} />
              <div className="h-4 w-10 rounded animate-pulse flex-shrink-0" style={{ background: "#E5E7EB" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
