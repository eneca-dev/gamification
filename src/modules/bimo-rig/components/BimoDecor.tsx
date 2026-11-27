import type { BimoDecorVariant } from '../decor'

// Положение, размер и задержка покачивания у каждого символа свои.
// Раскладки держат одинаковое число символов, чтобы меню и витрина выглядели
// одинаково плотно. `band` — полоса витрины во всю ширину: символы стоят
// по сторонам от героя, на узких экранах скрыты, иначе спорят с текстом.
// `sidebar` — вся высота бокового меню, символы у краёв, поэтому раскладка
// переносится и в свёрнутое меню.
const LAYOUTS: Record<BimoDecorVariant, readonly string[]> = {
  band: [
    'left-[30%] top-0 text-3xl',
    'left-[24%] top-10 text-xl',
    'left-[18%] bottom-10 text-2xl',
    'left-[27%] bottom-1 text-xl',
    'left-[36%] top-6 text-base',
    'right-[30%] top-1 text-2xl',
    'right-[23%] top-11 text-xl',
    'right-[17%] bottom-9 text-3xl',
    'right-[28%] bottom-1 text-xl',
    'right-[36%] top-7 text-base',
  ],
  // `preview` — маленькая примерка в админке: символов меньше и они мельче,
  // иначе они перекрывают самого Бимо в тесной карточке.
  preview: [
    'left-0 top-[6%] text-base',
    'right-1 top-[17%] text-sm',
    'left-1 top-[37%] text-sm',
    'right-0 top-[47%] text-base',
    'left-0 top-[67%] text-sm',
    'right-1 top-[77%] text-base',
  ],
  sidebar: [
    'left-2 top-[4%] text-xl',
    'right-3 top-[12%] text-base',
    'left-3 top-[21%] text-lg',
    'right-2 top-[30%] text-xl',
    'left-2 top-[39%] text-base',
    'right-3 top-[48%] text-lg',
    'left-3 top-[57%] text-xl',
    'right-2 top-[66%] text-base',
    'left-2 top-[76%] text-lg',
    'right-3 top-[85%] text-xl',
  ],
}
const VISIBILITY: Record<BimoDecorVariant, string> = {
  band: 'hidden lg:block',
  preview: 'block',
  sidebar: 'block',
}
// Символы меню лежат под подписями навигации, поэтому они бледнее витринных.
const OPACITY: Record<BimoDecorVariant, string> = {
  band: 'opacity-70',
  preview: 'opacity-60',
  sidebar: 'opacity-45',
}
/** Задержек покачивания шесть; длинная раскладка идёт по ним по кругу. */
const STAGGERS = 6

interface BimoDecorProps {
  /** Символы фона: короче раскладки — повторяются по кругу. */
  symbols: string[]
  variant: BimoDecorVariant
}

export function BimoDecor({ symbols, variant }: BimoDecorProps) {
  if (!symbols.length) return null
  return (
    <>
      {LAYOUTS[variant].map((spot, index) => (
        <span
          key={spot}
          aria-hidden="true"
          className={`bimo-decor stagger-${(index % STAGGERS) + 1} pointer-events-none absolute select-none ${OPACITY[variant]} ${VISIBILITY[variant]} ${spot}`}
        >
          {symbols[index % symbols.length]}
        </span>
      ))}
    </>
  )
}
