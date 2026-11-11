import {
  BIMO_CANVAS_HEIGHT,
  BIMO_CANVAS_WIDTH,
  BIMO_PORTRAIT_CELL,
  BIMO_PORTRAIT_OFFSET_Y,
  GLASSES_FILL,
  GLASSES_STROKE,
  bimoThumbLayers,
  type BimoAccessory,
  type BimoBackground,
  type BimoOutfit,
} from '@/modules/profile-appearance/index.client'

// Положение портретной ячейки внутри холста сцены — в процентах, чтобы превью
// масштабировалось вместе с карточкой.
const portraitBox = {
  left: 0,
  top: `${(BIMO_PORTRAIT_OFFSET_Y / BIMO_CANVAS_HEIGHT) * 100}%`,
  width: `${(BIMO_PORTRAIT_CELL / BIMO_CANVAS_WIDTH) * 100}%`,
  height: `${(BIMO_PORTRAIT_CELL / BIMO_CANVAS_HEIGHT) * 100}%`,
} as const

interface BimoThumbProps {
  look: { outfit: BimoOutfit; background: BimoBackground; accessory: BimoAccessory }
  alt: string
  className?: string
}

/**
 * Статичная поза покоя тремя слоями изображений. Canvas не используется:
 * на странице сотни Бимо, а все образы собираются из полутора десятков файлов.
 */
export function BimoThumb({ look, alt, className = '' }: BimoThumbProps) {
  const layers = bimoThumbLayers(look)

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${BIMO_CANVAS_WIDTH} / ${BIMO_CANVAS_HEIGHT}` }}
    >
      <img
        src={layers.background}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <img
        src={layers.portrait}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute"
        style={portraitBox}
      />
      {layers.raster && (
        <img
          src={layers.raster.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute"
          style={{ ...portraitBox, transformOrigin: layers.raster.origin, transform: layers.raster.transform }}
        />
      )}
      {layers.glasses && (
        <svg
          viewBox={`0 0 ${BIMO_CANVAS_WIDTH} ${BIMO_CANVAS_HEIGHT}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <g transform={layers.glasses.transform} fill={GLASSES_FILL} stroke={GLASSES_STROKE} strokeWidth={1.7}>
            <ellipse cx={0} cy={0} rx={15} ry={14} />
            <ellipse cx={40} cy={0} rx={15} ry={14} />
            <path d="M15 -1 Q20 -5 25 -1" fill="none" />
            <path d="M-15 -2 L-21 -5" fill="none" />
            <path d="M55 -2 L61 -5" fill="none" />
          </g>
        </svg>
      )}
    </div>
  )
}
