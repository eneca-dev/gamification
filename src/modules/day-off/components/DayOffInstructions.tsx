import { AlertTriangle, FileImage, Clock } from 'lucide-react'
import { ExampleImageButton } from './ExampleImageButton'

export function DayOffInstructions() {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div>
        <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--apex-text)' }}>
          Как взять выходной
        </h2>
        <p className="text-[13px]" style={{ color: 'var(--apex-text-secondary)' }}>
          Заполните новую заявку справа. Ваши заявки рассмотрит и одобрит HR в течение рабочего дня. После одобрения ваши стрики заморозятся и вы не получите штраф за красный день.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'var(--apex-success-bg)' }}
          >
            <Clock size={14} style={{ color: 'var(--apex-primary)' }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
              Дата выходного
            </p>
            <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
              Укажите дату выходного дня
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'var(--apex-success-bg)' }}
          >
            <FileImage size={14} style={{ color: 'var(--apex-primary)' }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
              Скриншот согласования
            </p>
            <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
              Прикрепите скриншот переписки с руководителем, где он подтверждает выходной.
              На скриншоте должны быть видны: дата запроса выходного, явное согласие от руководителя, имя и фамилия руководителя.
            </p>
            <ExampleImageButton />
          </div>
        </div>
      </div>

      <div
        className="flex items-start gap-2.5 p-3 rounded-xl"
        style={{ background: 'var(--apex-warning-bg)', border: '1px solid var(--apex-warning-border)' }}
      >
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--apex-warning-text)' }} />
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--apex-warning-dark)' }}>
          Эта заявка относится <strong>исключительно к системе геймификации</strong> и не является
          официальным документом. Официальное оформление выходного — через HR по стандартным каналам.
        </p>
      </div>
    </div>
  )
}
