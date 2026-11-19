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
 * Спокойная палитра: прибавки чередуются зелёным и синим, соседние секторы
 * разного тона, чтобы не сливались. Выделены только два края шкалы —
 * золотой главный приз ×2 и красные нули.
 */
const SECTOR_FILL: Record<typeof SECTORS[number], string> = {
  x2: 'var(--roulette-jackpot)',
  plus500: 'var(--roulette-green)',
  plus200: 'var(--roulette-blue)',
  plus100: 'var(--roulette-green-mid)',
  plus50: 'var(--roulette-blue-light)',
  zero1: 'var(--roulette-red)',
  zero2: 'var(--roulette-red-deep)',
}
// На золоте белые цифры не читаются — у главного приза тёмная подпись.
const SECTOR_TEXT: Record<typeof SECTORS[number], string> = {
  x2: 'var(--roulette-outline)',
  plus500: '#FFFFFF',
  plus200: '#FFFFFF',
  plus100: '#FFFFFF',
  plus50: '#FFFFFF',
  zero1: '#FFFFFF',
  zero2: '#FFFFFF',
}

/** Ход длится дольше обычного и очень долго замирает в конце: интрига важнее скорости. */
const SPIN_SECONDS = 18
const SPIN_TURNS = 8
/** Резкий старт и длинный хвост: к середине скорость уже мала, последние градусы ползут. */
const SPIN_TRANSITION = (reduced: boolean | null) => ({
  duration: reduced ? 0 : SPIN_SECONDS,
  ease: [0.08, 0.82, 0.06, 1] as const,
})

/** Координата с округлением: без него серверная и клиентская разметка расходятся. */
const at = (radius: number, radians: number, axis: 'x' | 'y') =>
  Math.round((100 + radius * (axis === 'x' ? Math.cos(radians) : Math.sin(radians))) * 1000) / 1000

/** Итог сектора для конкретной ставки: столько станет на балансе. */
export function sectorOutcome(sector: typeof SECTORS[number], stake: number): number {
  if (sector === 'x2') return stake * 2
  if (sector.startsWith('zero')) return 0
  return stake + Number(sector.slice(4))
}

export function RouletteWheel({ result, stake = null, armed = false, busy = false, onSpin, onReveal }: RouletteWheelProps) {
  const reduced = useReducedMotion()
  const operationId = result?.operationId
  useEffect(() => {
    if (!operationId) return
    // Release presentation even when animation completion is unavailable.
    const timer = setTimeout(() => onReveal?.(operationId), reduced ? 0 : (SPIN_SECONDS + 2) * 1000)
    return () => clearTimeout(timer)
  }, [operationId, onReveal, reduced])
  const index = result ? SECTORS.indexOf(result.sector) : -1
  const angle = 360 / SECTORS.length
  // Угол остановки колеса. Подписи поворачиваются на тот же угол в обратную
  // сторону вокруг собственной точки, иначе после хода они встают вверх ногами:
  // например на секторе +100 колесо встаёт ровно на 180°.
  const spinDeg = index < 0 ? 0 : SPIN_TURNS * 360 - (index + 0.5) * angle
  const live = armed || index >= 0

  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-label="Семь равновероятных секторов">
      <motion.svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className={`w-full transition-[filter] duration-500 ${live ? 'drop-shadow-lg' : 'drop-shadow saturate-[0.95]'}`}
        initial={false}
        animate={{ rotate: spinDeg }}
        transition={SPIN_TRANSITION(reduced)}
        onAnimationComplete={() => { if (operationId) onReveal?.(operationId) }}
      >
        <defs>
          <radialGradient id="roulette-gloss" cx="34%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {SECTORS.map((sector, i) => {
          const start = (i * angle - 90) * Math.PI / 180
          const end = ((i + 1) * angle - 90) * Math.PI / 180
          const middle = (start + end) / 2
          return (
            <g key={sector}>
              <path
                d={`M100 100 L${at(96, start, 'x')} ${at(96, start, 'y')} A96 96 0 0 1 ${at(96, end, 'x')} ${at(96, end, 'y')} Z`}
                fill={SECTOR_FILL[sector]}
                stroke="var(--roulette-rim-light)"
                strokeWidth="1.2"
              />
              <motion.g
                initial={false}
                animate={{ rotate: -spinDeg }}
                transition={SPIN_TRANSITION(reduced)}
                style={{ transformOrigin: `${at(64, middle, 'x')}px ${at(64, middle, 'y')}px` }}
              >
                <text
                  x={at(64, middle, 'x')}
                  y={at(64, middle, 'y') - (stake ? 4 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={SECTOR_TEXT[sector]}
                  className={sector === 'x2' ? 'text-[17px] font-black' : 'text-[14px] font-extrabold'}
                >
                  {SECTOR_LABELS[sector]}
                </text>
                {stake !== null && stake > 0 && (
                  <text
                    x={at(64, middle, 'x')}
                    y={at(64, middle, 'y') + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={SECTOR_TEXT[sector]}
                    fillOpacity="0.92"
                    className="text-[7px] font-bold"
                  >
                    {sectorOutcome(sector, stake).toLocaleString('ru-RU')}
                  </text>
                )}
              </motion.g>
            </g>
          )
        })}

        {/* Блик поверх секторов: объём без затемнения. */}
        <circle cx="100" cy="100" r="96" fill="url(#roulette-gloss)" pointerEvents="none" />
      </motion.svg>

      {/* Указатель неподвижен и нарисован отдельным слоем поверх обода. */}
      <svg viewBox="0 0 200 200" aria-hidden="true" className="pointer-events-none absolute inset-0 w-full">
        <defs>
          <linearGradient id="roulette-pointer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--roulette-rim-light)" />
            <stop offset="55%" stopColor="var(--roulette-rim)" />
            <stop offset="100%" stopColor="var(--roulette-rim-dark)" />
          </linearGradient>
        </defs>
        <g className="drop-shadow-md">
          {/* Капля остриём вниз: заходит на обод, поэтому видно выбранный сектор. */}
          <path
            d="M100 28 L109 11 Q109 2 100 2 Q91 2 91 11 Z"
            fill="url(#roulette-pointer)"
          />
          <circle cx="100" cy="10.5" r="2.4" fill="var(--roulette-rim-light)" />
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
