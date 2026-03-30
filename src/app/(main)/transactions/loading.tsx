export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 w-36 rounded-lg animate-pulse" style={{ background: "#E5E7EB" }} />
          <div className="h-4 w-20 rounded-lg animate-pulse" style={{ background: "#E5E7EB" }} />
        </div>

        <div className="space-y-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
              <div className="w-9 h-9 rounded-xl animate-pulse flex-shrink-0" style={{ background: "#E5E7EB" }} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
                <div className="h-3 w-1/3 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
              </div>
              <div className="h-4 w-12 rounded animate-pulse flex-shrink-0" style={{ background: "#E5E7EB" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
