import { AlertTriangle, FileImage } from 'lucide-react'

export function AdminDayOffInstructions() {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div>
        <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--apex-text)' }}>
          Как проверять заявки
        </h2>
        <p className="text-[13px]" style={{ color: 'var(--apex-text-secondary)' }}>
          Сотрудники подают заявки на геймификационные выходные со скриншотом согласования с руководителем.
          Заявки одобряются автоматически, но при необходимости вы можете одобрить или отклонить их вручную.
        </p>
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
            Перед решением проверьте скриншот переписки с руководителем. На нём должны быть видны:{' '}
            <strong>запрашиваемые даты, явное согласие от руководителя, имя и фамилия руководителя</strong>.
          </p>
        </div>
      </div>

      <div
        className="flex items-start gap-2.5 p-3 rounded-xl"
        style={{ background: 'var(--apex-warning-bg)', border: '1px solid var(--apex-warning-border)' }}
      >
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--apex-warning-text)' }} />
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--apex-warning-dark)' }}>
          Эта заявка относится <strong>исключительно к системе геймификации</strong> и не является
          официальным документом. Официальное оформление — по стандартному процессу компании.
        </p>
      </div>
    </div>
  )
}
