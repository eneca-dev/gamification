export type BimoOutfit = 'classic' | 'hoodie' | 'lavender-sweater' | 'blue-bomber' | 'coral-shirt'

export const BIMO_RASTER_ACCESSORIES = {
  'lavender-beret': {
    portrait: '/profile/accessories/lavender-beret-portrait-v1.webp',
    coffee: '/profile/accessories/lavender-beret-coffee-v1.webp',
    present: '/profile/accessories/lavender-beret-present-v1.webp',
    crystal: '/profile/accessories/lavender-beret-crystal-v1.webp',
  },
  'coral-scarf': {
    portrait: '/profile/accessories/coral-scarf-portrait-v1.webp',
    coffee: '/profile/accessories/coral-scarf-coffee-v1.webp',
    present: '/profile/accessories/coral-scarf-present-v1.webp',
    crystal: '/profile/accessories/coral-scarf-crystal-v1.webp',
  },
  'mint-cap': {
    portrait: '/profile/accessories/mint-cap-portrait-v1.webp',
    coffee: '/profile/accessories/mint-cap-coffee-v1.webp',
    present: '/profile/accessories/mint-cap-present-v1.webp',
    crystal: '/profile/accessories/mint-cap-crystal-v1.webp',
  },
  'blue-headphones': {
    portrait: '/profile/accessories/blue-headphones-portrait-v1.webp',
    coffee: '/profile/accessories/blue-headphones-coffee-v1.webp',
    present: '/profile/accessories/blue-headphones-present-v1.webp',
    crystal: '/profile/accessories/blue-headphones-crystal-v1.webp',
  },
} as const
export type BimoAccessory = 'none' | 'round-glasses' | keyof typeof BIMO_RASTER_ACCESSORIES

export const BIMO_BACKGROUNDS = {
  beach: '/profile/backgrounds/beach-v1.webp',
  'starry-evening': '/profile/backgrounds/starry-evening-v1.webp',
  office: '/profile/backgrounds/office-v1.webp',
  'green-courtyard': '/profile/backgrounds/green-courtyard-v1.webp',
  mint: '/profile/backgrounds/mint-v1.webp',
  peach: '/profile/backgrounds/peach-v1.webp',
  lavender: '/profile/backgrounds/lavender-v1.webp',
  clouds: '/profile/sky-clouds.webp',
} as const
export type BimoBackground = keyof typeof BIMO_BACKGROUNDS

// Shop previews are independent of character portraits and motion sheets.
export const BIMO_SHOP_PREVIEWS: Readonly<Partial<Record<string, string>>> = {
  'outfit.classic': '/profile/shop/classic-v1.webp',
  'outfit.hoodie': '/profile/shop/hoodie-v1.webp',
  'outfit.lavender_sweater': '/profile/shop/lavender-sweater-v1.webp',
  'outfit.blue_bomber': '/profile/shop/blue-bomber-v1.webp',
  'outfit.coral_shirt': '/profile/shop/coral-shirt-v1.webp',
  'accessory.round_glasses': '/profile/shop/round-glasses-v1.webp',
  'accessory.blue_headphones': '/profile/shop/blue-headphones-v1.webp',
  'accessory.mint_cap': '/profile/shop/mint-cap-v1.webp',
  'accessory.lavender_beret': '/profile/shop/lavender-beret-v1.webp',
  'accessory.coral_scarf': '/profile/shop/coral-scarf-v1.webp',
  'background.mint': BIMO_BACKGROUNDS.mint,
  'background.peach': BIMO_BACKGROUNDS.peach,
  'background.lavender': BIMO_BACKGROUNDS.lavender,
  'background.clouds': BIMO_BACKGROUNDS.clouds,
  'background.office': BIMO_BACKGROUNDS.office,
  'background.green_courtyard': BIMO_BACKGROUNDS['green-courtyard'],
  'background.beach': BIMO_BACKGROUNDS.beach,
  'background.starry_evening': BIMO_BACKGROUNDS['starry-evening'],
}
export type BimoEyes = readonly [number, number, number, number]

// Source-cell coordinates. Eyelid movement must not move the glasses.
export const PORTRAIT_EYES: BimoEyes = [131.5, 77, 172, 72]
export const BIMO_ACTIONS = [
  {
    id: 'coffee', name: 'Кофе', label: 'Бимо выпьет кофе', width: 256, height: 256,
    durations: [180,70,90,90,100,100,100,100,140,300,300,100,100,100,100,180],
    eyes: [
      [119,73.5,157,69], [119,73.5,157,69], [119,73.5,157,69], [118,73.5,157.5,69.5],
      [119,73.5,156.5,70], [117.5,74,157,69.5], [117.5,73.5,156.5,70], [116.5,74,156,70.5],
      [119.5,74,157,69.5], [119.5,74,157,69.5], [119.5,74,157,69.5], [119,73,157,69.5],
      [118,73,157,70], [119,74,156.5,69.5], [119,73.5,156.5,70], [117.5,74,157,69.5],
    ] satisfies BimoEyes[],
  },
  {
    id: 'present', name: 'Презентация', label: 'Бимо проведёт презентацию', width: 384, height: 256,
    durations: [180,100,100,100,120,120,140,350,350,350,180,140,120,120,100,180],
    eyes: [
      [125.5,72,167,72], [131,71,167,73], [131,71.5,176,71.5], [133,71,173,71],
      [133,71.5,173,70.5], [135.5,71.5,176,70.5], [135,70.5,176.5,70.5], [134,71.5,174.5,69.5],
      [134,70.5,174.5,70.5], [134,70.5,174.5,70.5], [134,70.5,174.5,70.5], [131,70.5,167.5,71],
      [126,72,168,72], [126,72,167.5,72], [126,72,167,71.5], [124.5,72.5,166,72.5],
    ] satisfies BimoEyes[],
  },
  {
    id: 'crystal', name: 'Прыжок', label: 'Бимо подпрыгнет с голубым кристаллом', width: 384, height: 320,
    durations: [180,120,120,180,140,80,80,100,140,80,80,140,180,140,120,180],
    eyes: [
      [128.5,144,163.5,139.5], [122.5,141.5,162.5,136], [121.5,141.5,164,134.5], [129,137.5,158,130.5],
      [123.5,152,163,145], [125.5,145,161,137], [128.5,132.5,162.5,126], [129.5,118.5,159.5,111],
      [128,118,159.5,110], [122,128,157.5,121.5], [127,138.5,159.5,132.5], [131.5,151,162.5,146],
      [123,141,163.5,134.5], [129,144,163,140], [126,144.5,164.5,140], [129,145,164,140],
    ] satisfies BimoEyes[],
  },
] as const

const LAVENDER_SWEATER_EYES: { portrait: BimoEyes; coffee: readonly BimoEyes[]; crystal: readonly BimoEyes[] } = {
  portrait: [131.5,78,172,73],
  coffee: [
    [119,72.5,157,68],
    [119,72.5,157,68],
    [119,72.5,157,68],
    [117,72.5,156.5,68.5],
    [120,72.5,157.5,69],
    [117.5,73,157,68.5],
    [117.5,72.5,156.5,69],
    [117.5,73,157,69.5],
    [119.5,73,157,68.5],
    [119.5,73,157,68.5],
    [119.5,73,157,68.5],
    [119,72,157,68.5],
    [118,73,157,70],
    [119,73,156.5,68.5],
    [120,72.5,157.5,69],
    [117.5,73,157,68.5],
  ],
  crystal: [
    [128.5,144,163.5,139.5],
    [122.5,142.5,162.5,137],
    [121.5,141.5,164,134.5],
    [129,138.5,158,131.5],
    [123.5,153,163,146],
    [125.5,146,161,138],
    [128.5,132.5,162.5,126],
    [129.5,119.5,159.5,112],
    [128,118,159.5,110],
    [122,129,157.5,122.5],
    [127,138.5,159.5,132.5],
    [130.5,151,161.5,146],
    [123,141,163.5,134.5],
    [129,144,163,140],
    [126,144.5,164.5,140],
    [128,145,163,140],
  ],
}

const BLUE_BOMBER_EYES: { portrait: BimoEyes; coffee: readonly BimoEyes[]; present: readonly BimoEyes[]; crystal: readonly BimoEyes[] } = {
  portrait: [131.5,77,172,72],
  coffee: [
    [114,71.5,152,67],
    [113,71.5,151,67],
    [114,71.5,152,67],
    [112,71.5,151.5,67.5],
    [114,71.5,151.5,68],
    [112.5,72,152,67.5],
    [112.5,71.5,151.5,68],
    [112.5,72,152,68.5],
    [114.5,72,152,67.5],
    [114.5,72,152,67.5],
    [114.5,72,152,67.5],
    [114,71,152,67.5],
    [113,71,152,68],
    [114,72,151.5,67.5],
    [114,71.5,151.5,68],
    [112.5,72,152,67.5],
  ],
  present: [
    [125.5,72,167,72],
    [132,71,168,73],
    [131,71.5,176,71.5],
    [133,71,173,71],
    [133,71.5,173,70.5],
    [135.5,71.5,176,70.5],
    [135,70.5,176.5,70.5],
    [134,71.5,174.5,69.5],
    [134,70.5,174.5,70.5],
    [134,70.5,174.5,70.5],
    [134,70.5,174.5,70.5],
    [131,70.5,167.5,71],
    [126,72,168,72],
    [126,72,167.5,72],
    [126,72,167,71.5],
    [124.5,72.5,166,72.5],
  ],
  crystal: [
    [128.5,144,163.5,139.5],
    [122.5,141.5,162.5,136],
    [121.5,141.5,164,134.5],
    [129,138.5,158,131.5],
    [123.5,153,163,146],
    [126.5,146,162,138],
    [128.5,132.5,162.5,126],
    [129.5,119.5,159.5,112],
    [128,119,159.5,111],
    [122,129,157.5,122.5],
    [127,138.5,159.5,132.5],
    [131.5,152,162.5,147],
    [123,141,163.5,134.5],
    [129,144,163,140],
    [126,144.5,164.5,140],
    [129,145,164,140],
  ],
}

const CORAL_SHIRT_EYES: { portrait: BimoEyes; coffee: readonly BimoEyes[]; present: readonly BimoEyes[]; crystal: readonly BimoEyes[] } = {
  portrait: [131.5,77,172,72],
  coffee: [
    [126.38,72.45,163.62,68.05],
    [125.38,72.45,162.62,68.05],
    [126,72.5,164,68],
    [124.39,72.46,163.1,68.54],
    [127.38,71.47,164.13,68.03],
    [124.5,73,164,68.5],
    [124.5,72.5,163.5,69],
    [124.5,73,164,69.5],
    [126.88,71.95,163.63,67.55],
    [126.5,73,164,68.5],
    [126.88,71.95,163.63,67.55],
    [126.38,70.97,163.62,67.53],
    [125.39,71.97,163.61,69.03],
    [126,73,163.5,68.5],
    [127.75,71.43,163.75,68.07],
    [124.89,71.95,163.6,67.55],
  ],
  present: [
    [125.5,72,167,72],
    [131,71,167,73],
    [131,71.5,176,71.5],
    [133,71,173,71],
    [133,71.5,173,70.5],
    [135.5,71.5,176,70.5],
    [135,70.5,176.5,70.5],
    [134,71.5,174.5,69.5],
    [134,70.5,174.5,70.5],
    [134,70.5,174.5,70.5],
    [134,70.5,174.5,70.5],
    [131,70.5,167.5,71],
    [126,72,168,72],
    [126,72,167.5,72],
    [126,72,167,71.5],
    [124.5,72.5,166,72.5],
  ],
  crystal: [
    [128.5,144,163.5,139.5],
    [122.5,141.5,162.5,136],
    [121.5,142.5,164,135.5],
    [129,138.5,158,131.5],
    [123.5,153,163,146],
    [125.5,146,161,138],
    [128.5,133.5,162.5,127],
    [129.5,119.5,159.5,112],
    [128,119,159.5,111],
    [122,129,157.5,122.5],
    [127,138.5,159.5,132.5],
    [131.5,151,162.5,146],
    [123,141,163.5,134.5],
    [129,144,163,140],
    [126,144.5,164.5,140],
    [129,145,164,140],
  ],
}

export function bimoEyes(outfit: BimoOutfit, action: typeof BIMO_ACTIONS[number], frame: number | null): BimoEyes {
  if (outfit === 'coral-shirt') return frame === null ? CORAL_SHIRT_EYES.portrait : CORAL_SHIRT_EYES[action.id][frame] ?? action.eyes[0]
  if (outfit === 'blue-bomber') return frame === null ? BLUE_BOMBER_EYES.portrait : BLUE_BOMBER_EYES[action.id][frame] ?? action.eyes[0]
  if (frame === null) return outfit === 'lavender-sweater' ? LAVENDER_SWEATER_EYES.portrait : PORTRAIT_EYES
  if (outfit === 'lavender-sweater' && action.id !== 'present') {
    return LAVENDER_SWEATER_EYES[action.id][frame] ?? action.eyes[0]
  }
  return action.eyes[frame] ?? action.eyes[0]
}

// Геометрия сцены. Холст и портретная ячейка — общие для Canvas и статичных превью.
export const BIMO_CANVAS_WIDTH = 384
export const BIMO_CANVAS_HEIGHT = 320
export const BIMO_PORTRAIT_CELL = 256
export const BIMO_PORTRAIT_OFFSET_Y = 64

export const GLASSES_STROKE = '#263b39'
export const GLASSES_FILL = 'rgba(218, 247, 246, 0.10)'

/** Портретные точки глаз костюма: в позе покоя они не зависят от движения. */
export function bimoPortraitEyes(outfit: BimoOutfit): BimoEyes {
  return bimoEyes(outfit, BIMO_ACTIONS[0], null)
}

export interface BimoThumbLayers {
  background: string
  portrait: string
  /** Прозрачный слой аксессуара: CSS-эквивалент аффинной правки по точкам глаз. */
  raster: { src: string; transform: string; origin: string } | null
  /** Очки рисуются векторно — Canvas'ом в сцене, SVG в превью. */
  glasses: { transform: string } | null
}

const percent = (value: number) => `${(value / BIMO_PORTRAIT_CELL) * 100}%`
const degrees = (radians: number) => `${(radians * 180) / Math.PI}deg`

/**
 * Слои статичной позы покоя для галереи: три изображения вместо Canvas.
 * Повторяет порядок и геометрию отрисовки `BimoPortrait` при `frame === null`.
 */
export function bimoThumbLayers(look: {
  outfit: BimoOutfit
  background: BimoBackground
  accessory: BimoAccessory
}): BimoThumbLayers {
  const target = bimoPortraitEyes(look.outfit)
  const layers: BimoThumbLayers = {
    background: BIMO_BACKGROUNDS[look.background],
    portrait: bimoSource(look.outfit),
    raster: null,
    glasses: null,
  }

  if (look.accessory === 'round-glasses') {
    const [lx, ly, rx, ry] = target
    const distance = Math.hypot(rx - lx, ry - ly)
    layers.glasses = {
      transform: `translate(${lx} ${ly + BIMO_PORTRAIT_OFFSET_Y}) rotate(${(Math.atan2(ry - ly, rx - lx) * 180) / Math.PI}) scale(${distance / 40})`,
    }
    return layers
  }

  if (look.accessory === 'none') return layers

  // Слой аксессуара нарисован для классических точек: поворачиваем и масштабируем
  // его вокруг исходной середины глаз, затем сдвигаем на середину глаз костюма.
  const base = PORTRAIT_EYES
  const rotation = Math.atan2(target[3] - target[1], target[2] - target[0]) - Math.atan2(base[3] - base[1], base[2] - base[0])
  const scale = Math.hypot(target[2] - target[0], target[3] - target[1]) / Math.hypot(base[2] - base[0], base[3] - base[1])
  const baseMid = { x: (base[0] + base[2]) / 2, y: (base[1] + base[3]) / 2 }
  const targetMid = { x: (target[0] + target[2]) / 2, y: (target[1] + target[3]) / 2 }

  layers.raster = {
    src: BIMO_RASTER_ACCESSORIES[look.accessory].portrait,
    origin: `${percent(baseMid.x)} ${percent(baseMid.y)}`,
    transform: `translate(${percent(targetMid.x - baseMid.x)}, ${percent(targetMid.y - baseMid.y)}) rotate(${degrees(rotation)}) scale(${scale})`,
  }
  return layers
}

export function bimoSource(outfit: BimoOutfit, action?: string) {
  if (outfit === 'coral-shirt') return `/profile/outfits/coral-shirt-${action ?? 'portrait'}-v1.webp`
  if (outfit === 'blue-bomber') return `/profile/outfits/blue-bomber-${action ?? 'portrait'}-v1.webp`
  if (outfit === 'lavender-sweater') return `/profile/outfits/lavender-sweater-${action ?? 'portrait'}-v1.webp`
  return outfit === 'hoodie'
    ? `/profile/outfits/hoodie-${action ?? 'portrait'}-v2.webp?v=neckline-1`
    : `/profile/bimo-${action ?? 'portrait'}.webp`
}
