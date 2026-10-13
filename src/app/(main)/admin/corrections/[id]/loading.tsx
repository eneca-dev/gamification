export default function AdminCorrectionUserLoading() {
  return (
    <div className="space-y-4">
      <div
        className="h-7 w-40 rounded-full animate-pulse"
        style={{ background: '#E5E7EB' }}
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-3 min-w-0">
          <SkeletonBlock height={160} />
          <SkeletonBlock height={320} />
          <SkeletonBlock height={220} />
        </div>
        <div className="space-y-3 min-w-0">
          <SkeletonBlock height={320} />
          <SkeletonBlock height={280} />
        </div>
      </div>
    </div>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      className="rounded-2xl animate-pulse"
      style={{ background: '#E5E7EB', height: `${height}px` }}
    />
  )
}
