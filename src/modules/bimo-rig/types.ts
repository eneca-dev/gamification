export type BimoItemKind = 'garment' | 'accessory' | 'necklace' | 'background'
export type BimoLayerName = 'outfit' | 'sleeve' | 'head' | 'neck' | 'image'

export interface BimoArt {
  outfit?: string
  sleeve?: string
  head?: string
  neck?: string
  image?: string
  modelVersion?: 4
}
export interface BimoLook {
  garment: BimoArt | null
  accessory: BimoArt | null
  backgroundSrc: string
}
export interface BimoStageProps extends Partial<BimoLook> {
  paused?: boolean
  speed?: number
  className?: string
  interactive?: boolean
  reaction?: { id: BimoReaction; key: number } | null
  frame?: number | null
  onPlayingChange?: (playing: boolean) => void
  onFrameChange?: (time: number) => void
}

export type BimoReaction = 'wonder' | 'crystal' | 'happy'
export interface BimoMotionPose {
  head: number
  tail: number
  arm: number
  surprise: number
  delight: number
  blink: number
  gem: number
  question: number
  gaze: number
}
