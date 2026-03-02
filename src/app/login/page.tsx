import Link from 'next/link'

export default function LoginPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--surface)' }}
    >
      <div
        className="w-full max-w-sm p-8 flex flex-col items-center gap-6"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Логотип */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg"
            style={{
              background: 'linear-gradient(135deg, #4CAF50, #66bb6a)',
              boxShadow: '0 4px 16px rgba(76,175,80,0.3)',
            }}
          >
            ПК
          </div>
          <div className="text-center">
            <div
              className="font-extrabold text-xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Система баллов
            </div>
            <div
              className="text-sm font-medium mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Геймификация
            </div>
          </div>
        </div>

        {/* Кнопка входа */}
        <Link
          href="/api/auth/worksection"
          className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #4CAF50, #43a047)',
            boxShadow: '0 2px 8px rgba(76,175,80,0.35)',
          }}
        >
          Войти через Worksection
        </Link>
      </div>
    </div>
  )
}
