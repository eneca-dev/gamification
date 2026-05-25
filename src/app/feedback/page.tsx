import { ArrowLeft } from 'lucide-react'

import { FeedbackForm } from '@/modules/feedback/components/FeedbackForm'

export const metadata = {
  title: 'Обратная связь — Геймификация',
}

export default function FeedbackPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--apex-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--apex-text)' }}>
            Обратная связь
          </h1>
          <p className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
            Нашли ошибку или есть идея? Расскажите нам.
          </p>
        </div>

        {/* Hint — switch tabs for screenshots */}
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3.5 mb-6 text-sm"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            color: 'var(--apex-text-secondary)',
          }}
        >
          <ArrowLeft size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--apex-primary)' }} />
          <span>
            Эта страница открыта в новой вкладке.{' '}
            <strong style={{ color: 'var(--apex-text)' }}>
              Вернитесь на предыдущую вкладку
            </strong>{' '}
            через браузер, чтобы сделать скриншоты или перепроверить, что именно идёт не так — затем вернитесь сюда.
          </span>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
          }}
        >
          <FeedbackForm />
        </div>
      </div>
    </div>
  )
}
