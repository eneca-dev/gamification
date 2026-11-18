'use client'

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SECTORS, SECTOR_LABELS } from '../types'
import type { SpinResult } from '../types'

interface RouletteWheelProps { result: SpinResult | null; onReveal: (operationId: string) => void }
export function RouletteWheel({ result, onReveal }: RouletteWheelProps) {
  const reduced = useReducedMotion()
  const operationId = result?.operationId
  useEffect(() => {
    if (!operationId) return
    // Release presentation even when animation completion is unavailable.
    const timer = setTimeout(() => onReveal(operationId), reduced ? 0 : 4000)
    return () => clearTimeout(timer)
  }, [operationId, onReveal, reduced])
  const index = result ? SECTORS.indexOf(result.sector) : -1
  const angle = 360 / SECTORS.length
  return (
    <div className="relative mx-auto w-full max-w-80 overflow-hidden" aria-label="Семь равновероятных секторов">
      <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-2xl text-[var(--apex-danger)]" aria-hidden>▼</span>
      <motion.svg viewBox="0 0 200 200" className="w-full" aria-hidden
        initial={false} animate={{ rotate: index < 0 ? 0 : 1440 - (index + 0.5) * angle }}
        transition={{ duration: reduced ? 0 : 3, ease: 'easeOut' }}
        onAnimationComplete={() => { if (operationId) onReveal(operationId) }}>
        {SECTORS.map((sector, i) => {
          const start = (i * angle - 90) * Math.PI / 180
          const end = ((i + 1) * angle - 90) * Math.PI / 180
          const middle = (start + end) / 2
          return <g key={sector}>
            <path d={`M100 100 L${100 + 94 * Math.cos(start)} ${100 + 94 * Math.sin(start)} A94 94 0 0 1 ${100 + 94 * Math.cos(end)} ${100 + 94 * Math.sin(end)} Z`}
              className={sector.startsWith('zero') ? 'fill-[var(--apex-error-bg)] stroke-[var(--apex-border)]' : 'fill-[var(--apex-success-bg)] stroke-[var(--apex-border)]'} />
            <text x={100 + 65 * Math.cos(middle)} y={100 + 65 * Math.sin(middle)}
              textAnchor="middle" dominantBaseline="middle" className="fill-[var(--apex-text)] text-[10px] font-bold">
              {SECTOR_LABELS[sector]}
            </text>
          </g>
        })}
        <circle cx="100" cy="100" r="12" className="fill-[var(--apex-primary)]" />
      </motion.svg>
    </div>
  )
}
