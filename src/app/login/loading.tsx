export default function LoginLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--surface)' }}
    >
      <div
        className="w-3 h-3 rounded-full animate-pulse"
        style={{ background: 'var(--green-400)' }}
      />
    </div>
  )
}
