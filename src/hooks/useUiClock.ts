'use client'

import { useSyncExternalStore } from 'react'

let now: number | null = null
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach(notify => notify())
    }, 60_000)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) { clearInterval(timer); timer = undefined; now = null }
  }
}
const getSnapshot = () => now
const getServerSnapshot = () => null

/** Только для UI: общий минутный таймер и стабильный пустой снимок при SSR/гидратации. */
export function useUiClock() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
