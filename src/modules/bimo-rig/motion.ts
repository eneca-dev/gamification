import type { BimoMotionPose, BimoReaction } from './types'

export const REACTIONS: ReadonlyArray<{ id: BimoReaction; title: string; duration: number }> = [
  { id: 'wonder', title: 'Что такое?', duration: 2400 },
  { id: 'crystal', title: 'Кристаллик', duration: 3000 },
  { id: 'happy', title: 'Доволен', duration: 2200 },
]
export const MODEL_PATH = '/bimo/model-v4'
export const MODEL_PARTS = ['body', 'head', 'eyes', 'pupils', 'arm', 'tail'] as const
export const SHOULDER = [286, 231] as const
export const FACE_CENTER_X = 262
export const LEFT_PAW_PATH = 'M115 352H130L174 364L166 384H115Z'
export const RIGHT_PAW_PATH = 'M397 352H382L338 364L346 384H397Z'
export const LEFT_ARM_PATH = 'M210 218H235L217 270L200 305L184 332L183 350L181.5 356L180.5 360L179 364L179 368L176.5 376L171 390H110V325L165 250Z'
export const ARM_MIRROR_X = 512
export const EYE_WINDOWS_PATH = 'M198 138Q218 128 245 139C247 151 241 161 227 164C208 167 195 157 198 138Z M275 139Q297 128 320 138C326 154 311 165 294 164C279 164 272 153 275 139Z'
export const SHOULDER_BLEND_PATH = 'M254 219H282Q291 232 294 251L292 270Q271 273 254 255Z'

export function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}
function envelope(time: number, rise: number, fall: number, end: number): number {
  return Math.min(smooth(time / rise), smooth((end - time) / (end - fall)))
}
export function eyeClosure(blink: number): { aperture: string; lid: string; lidOpacity: number; eyeOpacity: number } {
  const amount = Math.max(0, Math.min(1, blink))
  // Both edges meet on the same curved lid when the eye closes completely.
  const top = 100 + 56 * amount
  const bottom = 184 - 28 * amount
  const apertures: string[] = []
  const lids: string[] = []
  for (const [openLeft, openRight, closedLeft, closedRight] of [[185, 251, 195, 248], [263, 329, 274, 326]]) {
    const left = openLeft + (closedLeft - openLeft) * amount
    const right = openRight + (closedRight - openRight) * amount
    const controlLeft = left + (right - left) * 0.26
    const controlRight = right - (right - left) * 0.26
    const lid = `M${left} 148C${controlLeft} ${top} ${controlRight} ${top} ${right} 148`
    lids.push(lid)
    apertures.push(`${lid}C${controlRight} ${bottom} ${controlLeft} ${bottom} ${left} 148Z`)
  }
  return {
    aperture: apertures.join(' '),
    lid: lids.join(' '),
    lidOpacity: smooth(amount / 0.25),
    eyeOpacity: smooth((1 - amount) / 0.2),
  }
}
export function sampleMotion(elapsed: number, action: BimoReaction | null = null, actionTime = 0): BimoMotionPose {
  const phase = elapsed % 5100
  const blinkTime = phase - 4200
  const pose: BimoMotionPose = {
    head: 1.2 * Math.sin(elapsed / 6800 * Math.PI * 2),
    tail: 2.2 * Math.sin(elapsed / 4600 * Math.PI * 2),
    arm: 0, surprise: 0, delight: 0, gem: 0, question: 0, gaze: 0,
    blink: phase >= 4200 && phase < 4360 ? Math.min(smooth(blinkTime / 65), smooth((160 - blinkTime) / 85)) : 0,
  }
  const clip = REACTIONS.find(item => item.id === action)
  if (!clip || actionTime <= 0 || actionTime >= clip.duration) return pose
  if (action === 'wonder') {
    const amount = envelope(actionTime, 650, 1300, clip.duration)
    pose.head -= 3.5 * amount
    pose.surprise = amount
    pose.question = amount
    pose.blink *= 1 - amount
  } else if (action === 'crystal') {
    const amount = envelope(actionTime, 950, 1900, clip.duration)
    pose.head += 1.4 * amount
    pose.delight = 0.9 * amount
    pose.gaze = amount
    pose.gem = envelope(actionTime, 650, 2150, clip.duration)
    pose.blink *= 1 - amount
  } else {
    const amount = envelope(actionTime, 600, 1300, clip.duration)
    pose.head += 1.8 * amount * Math.sin(actionTime / 1800 * Math.PI * 2)
    pose.delight = amount
    const closure = envelope(actionTime - 300, 320, 850, 1250)
    pose.blink = 1 - (1 - pose.blink) * (1 - closure)
  }
  return pose
}
export function mouthPath(pose: BimoMotionPose): string {
  const idle = [232, 181, 256, 202, 280, 181, 256, 202]
  const happy = [229, 179, 256, 197, 283, 179, 256, 214]
  const wonder = [251, 190, 256, 178, 261, 190, 256, 202]
  const points = idle.map((value, i) => {
    const delighted = value + (happy[i] - value) * pose.delight
    const coordinate = delighted + (wonder[i] - delighted) * pose.surprise
    return i % 2 === 0 ? coordinate + FACE_CENTER_X - 256 : coordinate
  })
  return `M${points[0]} ${points[1]}Q${points[2]} ${points[3]} ${points[4]} ${points[5]}Q${points[6]} ${points[7]} ${points[0]} ${points[1]}Z`
}
export function armTransform(pose: BimoMotionPose): string {
  return `rotate(${pose.arm} ${SHOULDER[0]} ${SHOULDER[1]})`
}
export function gazeTransform(pose: BimoMotionPose): string {
  return `translate(${3.5 * pose.gaze} ${-2.8 * pose.gaze})`
}
export function gemTransform(pose: BimoMotionPose): string {
  return `translate(401 ${75 - 5 * pose.gem}) translate(43 47) scale(${0.86 + 0.14 * pose.gem}) translate(-43 -47)`
}
