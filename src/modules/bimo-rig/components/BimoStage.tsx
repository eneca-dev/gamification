'use client'

import { useEffect, useRef, useState } from 'react'
import { createMotionAnimator } from '../motion.client'
import { MODEL_PARTS, MODEL_PATH, REACTIONS } from '../motion'
import { DEFAULT_LOOK } from '../rig'
import { BimoModelFigure } from './BimoModelFigure'
import type { BimoLook, BimoStageProps } from '../types'

export function BimoStage({ garment = null, accessory = null, backgroundSrc = DEFAULT_LOOK.backgroundSrc, paused = false, speed = 1, className = '', interactive = false, reaction = null, frame = null, idPrefix, onPlayingChange, onFrameChange }: BimoStageProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const animator = useRef<ReturnType<typeof createMotionAnimator> | null>(null)
  const playingCallback = useRef(onPlayingChange)
  const frameCallback = useRef(onFrameChange)
  const consumedReaction = useRef<string | null>(null)
  const [loaded, setLoaded] = useState<{ look: BimoLook; key: string } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [nextReaction, setNextReaction] = useState(0)
  const garmentKey = JSON.stringify(garment), accessoryKey = JSON.stringify(accessory)
  const requestKey = JSON.stringify([garmentKey, accessoryKey, backgroundSrc, retry])
  const ready = loaded?.key === requestKey, failed = failedKey === requestKey
  const hasLook = Boolean(loaded)
  const clickable = interactive && reaction === null && frame === null
  const reactionId = reaction?.id, reactionKey = reaction?.key
  useEffect(() => { playingCallback.current = onPlayingChange }, [onPlayingChange])
  useEffect(() => { frameCallback.current = onFrameChange }, [onFrameChange])
  useEffect(() => {
    if (!svgRef.current) return
    const instance = createMotionAnimator(svgRef.current, value => {
      setPlaying(value)
      playingCallback.current?.(value)
    }, value => frameCallback.current?.(value))
    animator.current = instance
    return () => { instance.destroy(); animator.current = null; playingCallback.current?.(false) }
  }, [hasLook, clickable])
  useEffect(() => {
    const request = `${reactionId}:${reactionKey}`
    if (ready && reactionId && animator.current && consumedReaction.current !== request) {
      animator.current.play(reactionId)
      consumedReaction.current = request
    }
  }, [reactionId, reactionKey, ready])
  useEffect(() => { animator.current?.configure(paused || !ready, speed) }, [paused, speed, ready, hasLook, clickable])
  useEffect(() => {
    if (ready && frame !== null) animator.current?.seek(reactionId ?? 'crystal', frame)
  }, [frame, reactionId, ready])
  useEffect(() => {
    let cancelled = false
    const nextGarment = JSON.parse(garmentKey) as BimoLook['garment']
    const nextAccessory = JSON.parse(accessoryKey) as BimoLook['accessory']
    const parts = MODEL_PARTS.map(part => `${MODEL_PATH}/${part}.webp`)
    const urls = [...parts, backgroundSrc, ...Object.values(nextGarment ?? {}), ...Object.values(nextAccessory ?? {})].filter((value): value is string => typeof value === 'string')
    void Promise.all([...new Set(urls)].map(async src => {
      const image = new Image(); image.src = src; await image.decode()
    })).then(() => {
      if (!cancelled) { setLoaded({ look: { garment: nextGarment, accessory: nextAccessory, backgroundSrc }, key: requestKey }); setFailedKey(null) }
    }).catch(() => { if (!cancelled) setFailedKey(requestKey) })
    return () => { cancelled = true }
  }, [garmentKey, accessoryKey, backgroundSrc, requestKey])
  function showNextReaction() {
    if (!ready || playing || paused) return
    if (animator.current?.play(REACTIONS[nextReaction].id)) setNextReaction(index => (index + 1) % REACTIONS.length)
  }
  const figure = <svg ref={svgRef} viewBox="0 0 600 500" role="img" aria-label="Бимо" className={`block h-auto w-full ${hasLook ? '' : 'invisible'}`}>
      <BimoModelFigure look={loaded?.look ?? DEFAULT_LOOK} idPrefix={idPrefix} />
    </svg>
  // mx-auto обязателен: при ширине по умолчанию блок уже контейнера, и без
  // центрирования он прижимается к левому краю (так было в сайдбаре).
  return <div className={`mx-auto flex max-w-full flex-col items-center gap-2 ${className || 'w-[180px]'}`} aria-busy={!ready && !failed}>
    {clickable ? <button type="button" onClick={showNextReaction} disabled={!ready} aria-disabled={playing || paused}
      aria-label={playing ? 'Бимо. Выполняется реакция' : `Бимо. Показать реакцию «${REACTIONS[nextReaction].title}»`}
      title="Нажмите на Бимо, чтобы посмотреть следующую реакцию"
      className="block w-full cursor-pointer rounded-xl border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--apex-focus)] disabled:cursor-wait">
      {figure}
    </button> : figure}
    {!hasLook && !failed && <p role="status" className="text-xs text-[var(--apex-text-muted)]">Загружаем Бимо…</p>}
    {failed && <div role="status" className="text-center text-xs text-[var(--apex-text-secondary)]">
      <p>Не удалось загрузить образ.</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-1 underline">Повторить</button>
    </div>}
  </div>
}
