export default function HelpLoading() {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-label="Загрузка">
      <div className="h-6 w-48 rounded-lg" style={{ background: '#E5E7EB' }} />
      <div className="h-3 w-32 rounded" style={{ background: '#E5E7EB' }} />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full rounded" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-5/6 rounded" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-4/6 rounded" style={{ background: '#E5E7EB' }} />
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full rounded" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-3/4 rounded" style={{ background: '#E5E7EB' }} />
      </div>
    </div>
  )
}
