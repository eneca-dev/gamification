'use client'

import { useState, useTransition } from 'react'
import { setStreakShieldAutoEnabled } from '../index.client'

export function AutoShieldSetting({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function change() {
    const next = !enabled
    setError(null)
    startTransition(async () => {
      const result = await setStreakShieldAutoEnabled(next)
      if (result.success) { setEnabled(next); setConfirming(false) }
      else setError(result.error)
    })
  }

  return (
    <section className="rounded-2xl p-5" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--apex-text)' }}>Автоматическое спасение стриков</h2>
          <p className="text-[12px] mt-1" style={{ color: 'var(--apex-text-secondary)' }}>
            При угрозе сначала применяются бесплатные жизни, затем купленные защиты. Новые покупки при угрозе не совершаются.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" role="switch" aria-label="Автоматическое спасение стриков" aria-checked={enabled}
            onClick={() => { setError(null); setConfirming(true) }} disabled={pending || confirming}
            className="relative w-9 h-5 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ background: enabled ? 'var(--apex-primary)' : 'var(--apex-border)' }}>
            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }} />
          </button>
          <span className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>{enabled ? 'Включено' : 'Выключено'}</span>
        </div>
      </div>
      {confirming && <div role="alertdialog" aria-labelledby="shield-confirm-title" aria-describedby="shield-confirm-description"
        className="mt-4 max-w-sm rounded-xl p-4 shadow-md" style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}>
        <p id="shield-confirm-title" className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          {enabled ? 'Выключить автоматическое спасение?' : 'Включить автоматическое спасение?'}
        </p>
        <p id="shield-confirm-description" className="mt-1 text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
          {enabled ? 'Новые стрики под угрозой больше не будут спасаться автоматически.' : 'Новые стрики под угрозой будут спасаться без подтверждения сотрудника.'}
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={change} disabled={pending} autoFocus
            className="rounded-lg px-3 py-1.5 text-[12px] text-white disabled:opacity-50" style={{ background: 'var(--apex-primary)' }}>
            {pending ? 'Сохраняем…' : 'Подтвердить'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending}
            className="rounded-lg px-3 py-1.5 text-[12px]" style={{ color: 'var(--apex-text)' }}>Отмена</button>
        </div>
      </div>}
      {error && <p role="alert" className="text-[12px] mt-2" style={{ color: 'var(--apex-danger)' }}>{error}</p>}
    </section>
  )
}
