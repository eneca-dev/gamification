import { armTransform, eyeClosure, gazeTransform, gemTransform, mouthPath, REACTIONS, sampleMotion } from './motion'
import type { BimoMotionPose, BimoReaction } from './types'

export function createMotionAnimator(svg: SVGSVGElement, onPlayingChange: (playing: boolean) => void = () => {}, onFrameChange: (time: number) => void = () => {}) {
  const nodes = new Map([...svg.querySelectorAll<SVGElement>('[data-model]')].map(element => [element.dataset.model, element]))
  const eyeWindow = svg.querySelector<SVGPathElement>('[data-eye-window]')
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let elapsed = 0, actionTime = 0, action: (typeof REACTIONS)[number] | null = null
  let previous: number | null = null, frame = 0
  let paused = false, speed = 1, playing = false, destroyed = false

  function paint(pose: BimoMotionPose) {
    const eyes = eyeClosure(pose.blink)
    nodes.get('tail')?.setAttribute('transform', `rotate(${pose.tail} 181 397)`)
    nodes.get('head')?.setAttribute('transform', `rotate(${pose.head} 256 220)`)
    nodes.get('arm')?.setAttribute('transform', armTransform(pose))
    nodes.get('mouth')?.setAttribute('d', mouthPath(pose))
    nodes.get('gem')?.setAttribute('opacity', String(pose.gem))
    nodes.get('gem')?.setAttribute('transform', gemTransform(pose))
    nodes.get('pupils')?.setAttribute('transform', gazeTransform(pose))
    nodes.get('question')?.setAttribute('opacity', String(pose.question))
    nodes.get('question')?.setAttribute('transform', `translate(403 ${103 - 5 * pose.question})`)
    nodes.get('eye-content')?.setAttribute('opacity', String(eyes.eyeOpacity))
    nodes.get('eyelids')?.setAttribute('d', eyes.lid)
    nodes.get('eyelids')?.setAttribute('opacity', String(eyes.lidOpacity))
    eyeWindow?.setAttribute('d', eyes.aperture)
    onFrameChange(actionTime)
  }
  function setPlaying(value: boolean) {
    if (playing === value) return
    playing = value
    onPlayingChange(value)
  }
  function tick(now: number) {
    if (destroyed || paused || document.hidden || media.matches) return
    const delta = previous === null ? 0 : Math.max(0, now - previous) * speed
    previous = now
    elapsed += delta
    if (playing && action) {
      actionTime = Math.min(action.duration, actionTime + delta)
      if (actionTime === action.duration) setPlaying(false)
    }
    paint(sampleMotion(elapsed, action?.id, actionTime))
    frame = requestAnimationFrame(tick)
  }
  function restart() {
    cancelAnimationFrame(frame)
    previous = null
    if (destroyed) return
    paint(sampleMotion(elapsed, action?.id, actionTime))
    if (!paused && !document.hidden && !media.matches) frame = requestAnimationFrame(tick)
  }
  function visibilityChanged() { restart() }
  function motionPreferenceChanged() {
    elapsed = 0
    action = null
    actionTime = 0
    setPlaying(false)
    paint(sampleMotion(0))
    restart()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  media.addEventListener('change', motionPreferenceChanged)
  onPlayingChange(false)
  restart()
  return {
    configure(nextPaused: boolean, nextSpeed: number) {
      paused = nextPaused
      speed = Number.isFinite(nextSpeed) ? Math.max(0.1, Math.min(2, nextSpeed)) : 1
      restart()
    },
    play(id: BimoReaction) {
      if (playing && !paused) return false
      const clip = REACTIONS.find(item => item.id === id)
      if (!clip) return false
      action = clip
      actionTime = media.matches ? 950 : 0
      setPlaying(!media.matches)
      restart()
      return true
    },
    seek(id: BimoReaction, time: number) {
      const clip = REACTIONS.find(item => item.id === id)
      if (!clip) return
      action = clip
      actionTime = Math.max(0, Math.min(clip.duration, time))
      paused = true
      setPlaying(!media.matches && actionTime < clip.duration)
      restart()
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visibilityChanged)
      media.removeEventListener('change', motionPreferenceChanged)
    },
  }
}
