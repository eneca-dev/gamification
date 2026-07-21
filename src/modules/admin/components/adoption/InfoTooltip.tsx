'use client'

import { useRef, useState } from 'react'

import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

// Иконка-подсказка рядом с заголовком карточки: короткое описание + формула
// на hover/focus. При нехватке места у края экрана тултип сдвигается внутрь
// (влево) и разворачивается вверх, чтобы поместиться целиком.
interface InfoTooltipProps {
  desc: string
  formula?: ReactNode
}

const MARGIN = 8

export function InfoTooltip({ desc, formula }: InfoTooltipProps) {
  const [state, setState] = useState<{ open: boolean; x: number; above: boolean }>({
    open: false,
    x: 0,
    above: false,
  })
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)

  // Тултип всегда в DOM (скрыт), поэтому его размеры можно замерить до показа
  // и сразу выбрать позицию, помещающуюся в экран
  const show = () => {
    const wrap = wrapRef.current?.getBoundingClientRect()
    const tip = tipRef.current
    if (!wrap || !tip) {
      setState((s) => ({ ...s, open: true }))
      return
    }
    const tw = tip.offsetWidth
    const th = tip.offsetHeight

    // Прижат к иконке (left-0); сдвигаем влево, если вылезает за правый край,
    // но не дальше левого края экрана
    let x = 0
    const rightEdge = wrap.left + tw
    if (rightEdge > window.innerWidth - MARGIN) x = window.innerWidth - MARGIN - rightEdge
    if (wrap.left + x < MARGIN) x = MARGIN - wrap.left

    // Вверх, если снизу не помещается, а сверху место есть
    const above =
      wrap.bottom + 6 + th > window.innerHeight - MARGIN && wrap.top - 6 - th > MARGIN

    setState({ open: true, x, above })
  }
  const hide = () => setState((s) => ({ ...s, open: false }))

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex align-middle"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        className="inline-flex cursor-help"
        aria-label="Подробнее о показателе"
        onFocus={show}
        onBlur={hide}
      >
        <Info size={13} style={{ color: 'var(--apex-text-muted)' }} />
      </button>
      <span
        ref={tipRef}
        role="tooltip"
        className={`pointer-events-none absolute left-0 z-30 w-[260px] rounded-lg p-2.5 text-[11px] leading-snug transition-opacity duration-150 ${state.above ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        style={{
          transform: `translateX(${state.x}px)`,
          opacity: state.open ? 1 : 0,
          visibility: state.open ? 'visible' : 'hidden',
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
          color: 'var(--apex-text-secondary)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
        }}
      >
        {desc}
        {formula && (
          <span
            className="mt-2 flex items-center justify-center gap-1.5 rounded px-2 py-2 text-[11px]"
            style={{ background: 'var(--apex-bg)', color: 'var(--apex-text)' }}
          >
            {formula}
          </span>
        )}
      </span>
    </span>
  )
}

// Дробь: числитель над чертой, знаменатель под ней — читается как формула
export function Fraction({ num, den }: { num: string; den: string }) {
  return (
    <span className="inline-flex flex-col items-center text-center leading-tight">
      <span className="px-1 pb-0.5">{num}</span>
      <span className="w-full" style={{ borderTop: '1px solid var(--apex-text-muted)' }} />
      <span className="px-1 pt-0.5">{den}</span>
    </span>
  )
}
