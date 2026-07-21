'use client'

import { useRef, useState } from 'react'

import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

// Иконка-подсказка рядом с заголовком карточки: короткое описание + формула
// на hover/focus. Тултип рендерится только когда открыт (иначе не создавал бы
// лишнюю ширину страницы), а позиция считается заранее по фиксированной ширине,
// чтобы поместиться в экран: сдвиг влево у правого края, разворот вверх снизу.
interface InfoTooltipProps {
  desc: string
  formula?: ReactNode
}

const MARGIN = 8
const WIDTH = 260
const EST_HEIGHT = 150

export function InfoTooltip({ desc, formula }: InfoTooltipProps) {
  const [state, setState] = useState<{ open: boolean; x: number; above: boolean }>({
    open: false,
    x: 0,
    above: false,
  })
  const wrapRef = useRef<HTMLSpanElement>(null)

  const show = () => {
    const wrap = wrapRef.current?.getBoundingClientRect()
    if (!wrap) {
      setState({ open: true, x: 0, above: false })
      return
    }
    // Прижат к иконке (left-0); сдвигаем влево, если правый край вылезает за экран,
    // но не дальше левого края
    let x = 0
    const rightEdge = wrap.left + WIDTH
    if (rightEdge > window.innerWidth - MARGIN) x = window.innerWidth - MARGIN - rightEdge
    if (wrap.left + x < MARGIN) x = MARGIN - wrap.left

    // Вверх, если снизу не помещается, а сверху место есть
    const above =
      wrap.bottom + 6 + EST_HEIGHT > window.innerHeight - MARGIN && wrap.top - 6 - EST_HEIGHT > MARGIN

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
      {state.open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-0 z-30 w-[260px] rounded-lg p-2.5 text-[11px] leading-snug ${state.above ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
          style={{
            transform: `translateX(${state.x}px)`,
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
      )}
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
