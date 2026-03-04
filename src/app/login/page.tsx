import Link from 'next/link'

function PhoneIllustration() {
  return (
    <svg viewBox="0 0 220 250" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-80 h-96">
      {/* Листья верх-право */}
      <ellipse cx="185" cy="30" rx="14" ry="28" fill="#a8d5c2" transform="rotate(-35 185 30)" />
      <ellipse cx="200" cy="55" rx="11" ry="22" fill="#c8e8d8" transform="rotate(-50 200 55)" />
      {/* Жёлтый акцент */}
      <ellipse cx="192" cy="70" rx="9" ry="18" fill="#f5e09a" transform="rotate(-25 192 70)" />
      {/* Листья низ-лево */}
      <ellipse cx="18" cy="215" rx="12" ry="26" fill="#1B6B58" transform="rotate(25 18 215)" />
      <ellipse cx="38" cy="230" rx="10" ry="22" fill="#2e8b67" transform="rotate(15 38 230)" />

      {/* Рука */}
      <ellipse cx="108" cy="198" rx="58" ry="32" fill="#f4b06a" />
      <ellipse cx="58" cy="182" rx="22" ry="13" fill="#f4b06a" transform="rotate(-25 58 182)" />

      {/* Корпус телефона */}
      <rect x="62" y="42" width="92" height="162" rx="16" fill="#dce8f0" />
      {/* Экран */}
      <rect x="70" y="56" width="76" height="122" rx="10" fill="#eef4ff" />
      {/* Нотч */}
      <rect x="92" y="52" width="32" height="6" rx="3" fill="#c4d4e2" />

      {/* Зелёный круг с замком */}
      <circle cx="108" cy="138" r="24" fill="#1B6B58" />
      {/* Дужка замка */}
      <path d="M100 138 v-7 a8 8 0 0 1 16 0 v7" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Тело замка */}
      <rect x="97" y="140" width="22" height="15" rx="4" fill="white" />
      {/* Скважина */}
      <circle cx="108" cy="147" r="3" fill="#1B6B58" />

      {/* Точки пароля */}
      <circle cx="87" cy="178" r="4" fill="#8fa8c0" />
      <circle cx="100" cy="178" r="4" fill="#8fa8c0" />
      <circle cx="113" cy="178" r="4" fill="#8fa8c0" />
      <circle cx="126" cy="178" r="4" fill="#8fa8c0" />
    </svg>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-5xl mx-auto px-10 flex flex-col md:flex-row items-center gap-12 md:justify-between">

        {/* Левая колонка — текст и кнопка */}
        <div className="flex-1 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--apex-text)' }}>
              Вход в приложение
            </h1>
            <p className="text-sm leading-snug max-w-sm" style={{ color: 'var(--apex-text)' }}>
              Авторизация доступна только сотрудникам компании с действующим аккаунтом Worksection.
            </p>
          </div>
          <Link
            href="/api/auth/worksection"
            className="self-start py-2 px-5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--apex-primary)' }}
          >
            Войти через Worksection
          </Link>
        </div>

        {/* Правая колонка — иллюстрация */}
        <div
          className="w-[28rem] h-[28rem] flex items-center justify-center flex-shrink-0"
          style={{
            background: 'var(--apex-success-bg)',
            borderRadius: '62% 38% 46% 54% / 56% 44% 56% 44%',
          }}
        >
          <PhoneIllustration />
        </div>

      </div>
    </div>
  )
}
