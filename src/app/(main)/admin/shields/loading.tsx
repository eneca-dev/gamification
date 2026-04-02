export default function AdminShieldsLoading() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="h-5 w-48 rounded bg-[#E5E7EB] animate-pulse mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-32 rounded bg-[#E5E7EB] animate-pulse" />
            <div className="h-4 w-24 rounded bg-[#E5E7EB] animate-pulse" />
            <div className="h-4 w-20 rounded bg-[#E5E7EB] animate-pulse" />
            <div className="h-4 w-28 rounded bg-[#E5E7EB] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
