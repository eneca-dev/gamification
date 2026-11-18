import { DEFAULT_LOOK } from '../rig'
import { BimoModelFigure } from './BimoModelFigure'
import type { BimoLook } from '../types'

interface BimoStillProps extends Partial<BimoLook> {
  alt?: string
  className?: string
  /** Без фона и с узкой рамкой — для мини-превью в плашках и списках. */
  compact?: boolean
}

export function BimoStill({ garment = null, accessory = null, backgroundSrc = DEFAULT_LOOK.backgroundSrc, alt = 'Бимо', className = '', compact = false }: BimoStillProps) {
  return <svg
    viewBox={compact ? '160 70 280 280' : '0 0 600 500'}
    role="img"
    aria-label={alt}
    className={`block h-auto w-full ${className}`}
  >
    <BimoModelFigure look={{ garment, accessory, backgroundSrc }} background={!compact} />
  </svg>
}
