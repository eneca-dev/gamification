'use client'

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SECTORS, SECTOR_LABELS } from '../types'
import type { SpinResult } from '../types'

interface RouletteWheelProps {
  result: SpinResult | null
  /** Ставка: по ней на секторах показываются реальные суммы, а не множители. */
  stake?: number | null
  /** Взведено: колесо в полную яркость, в центре появляется кнопка хода. */
  armed?: boolean
  busy?: boolean
  onSpin?: () => void
  /** Колесо остановилось: сайдбар снимает маску с баланса. */
  onReveal?: (operationId: string) => void
}

/**
 * Классические цвета колеса: зелёные выигрыши, жёлтые и янтарные прибавки,
 * красные нули. Соседние секторы разного тона, чтобы не сливались.
 * Главный приз выделен тёмной зеленью и золотой надписью.
 */
const SECTOR_FILL: Record<typeof SECTORS[number], string> = {
  x2: 'var(--roulette-prize)',
  plus500: 'var(--roulette-green)',
  plus200: 'var(--roulette-yellow)',
  plus100: 'var(--roulette-green-mid)',
  plus50: 'var(--roulette-amber)',
  zero1: 'var(--roulette-red)',
  zero2: 'var(--roulette-red-deep)',
}
// На жёлтом белые цифры не читаются — там тёмная подпись.
const SECTOR_TEXT: Record<typeof SECTORS[number], string> = {
  x2: 'var(--roulette-gold-light)',
  plus500: '#FFFFFF',
  plus200: 'var(--roulette-outline)',
  plus100: '#FFFFFF',
  plus50: '#FFFFFF',
  zero1: '#FFFFFF',
  zero2: '#FFFFFF',
}

/** Итог сектора для конкретной ставки: столько станет на балансе. */
export function sectorOutcome(sector: typeof SECTORS[number], stake: number): number {
  if (sector === 'x2') return stake * 2
  if (sector.startsWith('zero')) return 0
  return stake + Number(sector.slice(4))
}

/** Четырёхлучевая блёстка на ободе. */
function Sparkle({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <path
      d={`M${x} ${y - size} Q${x + size * 0.28} ${y - size * 0.28} ${x + size} ${y} Q${x + size * 0.28} ${y + size * 0.28} ${x} ${y + size} Q${x - size * 0.28} ${y + size * 0.28} ${x - size} ${y} Q${x - size * 0.28} ${y - size * 0.28} ${x} ${y - size} Z`}
      fill="#FFFFFF"
      fillOpacity="0.9"
    />
  )
}

export function RouletteWheel({ result, stake = null, armed = false, busy = false, onSpin, onReveal }: RouletteWheelProps) {
  const reduced = useReducedMotion()
  const operationId = result?.operationId
  useEffect(() => {
    if (!operationId) return
    // Release presentation even when animation completion is unavailable.
    const timer = setTimeout(() => onReveal?.(operationId), reduced ? 0 : 4000)
    return () => clearTimeout(timer)
  }, [operationId, onReveal, reduced])
  const index = result ? SECTORS.indexOf(result.sector) : -1
  const angle = 360 / SECTORS.length
  const live = armed || index >= 0

  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-label="Семь равновероятных секторов">
      <motion.svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className={`w-full transition-[filter] duration-500 ${live ? 'drop-shadow-lg' : 'drop-shadow saturate-[0.95]'}`}
        initial={false}
        animate={{ rotate: index < 0 ? 0 : 1440 - (index + 0.5) * angle }}
        transition={{ duration: reduced ? 0 : 3, ease: 'easeOut' }}
        onAnimationComplete={() => { if (operationId) onReveal?.(operationId) }}
      >
        <defs>
          <linearGradient id="roulette-rim" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="var(--roulette-gold-light)" />
            <stop offset="35%" stopColor="var(--roulette-gold)" />
            <stop offset="65%" stopColor="var(--roulette-gold-dark)" />
            <stop offset="100%" stopColor="var(--roulette-gold)" />
          </linearGradient>
          <radialGradient id="roulette-gloss" cx="34%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Золотой обод с блёстками. Внутренняя кромка светлая, не тёмная. */}
        <circle cx="100" cy="100" r="97" fill="url(#roulette-rim)" stroke="var(--roulette-outline)" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="var(--roulette-gold-light)" strokeWidth="2" />

        {SECTORS.map((sector, i) => {
          const start = (i * angle - 90) * Math.PI / 180
          const end = ((i + 1) * angle - 90) * Math.PI / 180
          const middle = (start + end) / 2
          return (
            <g key={sector}>
              <path
                d={`M100 100 L${100 + 87 * Math.cos(start)} ${100 + 87 * Math.sin(start)} A87 87 0 0 1 ${100 + 87 * Math.cos(end)} ${100 + 87 * Math.sin(end)} Z`}
                fill={SECTOR_FILL[sector]}
                stroke="var(--roulette-gold-light)"
                strokeWidth="1.2"
              />
              <text
                x={100 + 60 * Math.cos(middle)}
                y={100 + 60 * Math.sin(middle) - (stake ? 4 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={SECTOR_TEXT[sector]}
                className={sector === 'x2' ? 'text-[17px] font-black' : 'text-[14px] font-extrabold'}
              >
                {SECTOR_LABELS[sector]}
              </text>
              {stake !== null && stake > 0 && (
                <text
                  x={100 + 60 * Math.cos(middle)}
                  y={100 + 60 * Math.sin(middle) + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={SECTOR_TEXT[sector]}
                  fillOpacity="0.92"
                  className="text-[7px] font-bold"
                >
                  {sectorOutcome(sector, stake).toLocaleString('ru-RU')}
                </text>
              )}
            </g>
          )
        })}

        {/* Заклёпки на границах секторов и блёстки между ними. */}
        {SECTORS.map((sector, i) => {
          const bolt = (i * angle - 90) * Math.PI / 180
          const shine = ((i + 0.5) * angle - 90) * Math.PI / 180
          return (
            <g key={`rim-${sector}`}>
              <circle cx={100 + 92.5 * Math.cos(bolt)} cy={100 + 92.5 * Math.sin(bolt)} r="2.2"
                fill="var(--roulette-gold-light)" stroke="var(--roulette-gold-dark)" strokeWidth="0.6" />
              <Sparkle x={100 + 92.5 * Math.cos(shine)} y={100 + 92.5 * Math.sin(shine)} size={i % 2 ? 2.6 : 3.6} />
            </g>
          )
        })}

        {/* Блик поверх секторов: объём без затемнения. */}
        <circle cx="100" cy="100" r="87" fill="url(#roulette-gloss)" pointerEvents="none" />
      </motion.svg>

      {/* Указатель неподвижен и нарисован отдельным слоем поверх обода. */}
      <svg viewBox="0 0 200 200" aria-hidden="true" className="pointer-events-none absolute inset-0 w-full">
        <defs>
          <linearGradient id="roulette-pointer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--roulette-gold-light)" />
            <stop offset="55%" stopColor="var(--roulette-gold)" />
            <stop offset="100%" stopColor="var(--roulette-gold-dark)" />
          </linearGradient>
        </defs>
        <g className="drop-shadow-md">
          {/* Капля остриём вниз: заходит на обод, поэтому видно выбранный сектор. */}
          <path
            d="M100 40 L115 14 Q115 2 100 2 Q85 2 85 14 Z"
            fill="url(#roulette-pointer)"
            stroke="var(--roulette-outline)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="100" cy="13" r="4" fill="var(--roulette-gold-light)" stroke="var(--roulette-outline)" strokeWidth="1.2" />
        </g>
      </svg>

      {/* Ступица не вращается вместе с колесом: в ней живёт кнопка хода. */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        {onSpin ? (
          <button
            type="button"
            onClick={onSpin}
            disabled={busy}
            className="flex h-24 w-24 items-center justify-center rounded-full border-4 text-[13px] font-black uppercase tracking-wide shadow-xl transition-transform duration-200 enabled:hover:scale-105 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--apex-focus)]"
            style={{
              background: 'radial-gradient(circle at 35% 30%, var(--roulette-gold-light), var(--roulette-gold) 55%, var(--roulette-gold-dark))',
              borderColor: 'var(--roulette-outline)',
              color: 'var(--roulette-outline)',
            }}
          >
            {busy ? 'Крутим…' : 'Крутить'}
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="block h-20 w-20 rounded-full border-4 shadow-lg"
            style={{
              background: 'radial-gradient(circle at 35% 30%, var(--roulette-gold-light), var(--roulette-gold) 55%, var(--roulette-gold-dark))',
              borderColor: 'var(--roulette-outline)',
            }}
          />
        )}
      </div>
    </div>
  )
}
