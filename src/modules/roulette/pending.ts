import { useSyncExternalStore } from 'react'
import { confirmationSchema, type Confirmation } from './types'

const prefix = (userId: string) => 'roulette:pending:' + userId + ':'
const key = (userId: string, value: Confirmation) => prefix(userId) + value.period + ':' + value.operationId
const changed = 'roulette-pending-changed'
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(changed, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(changed, callback)
  }
}
function snapshot(userId: string) {
  try {
    return Object.keys(localStorage).filter(name => name.startsWith(prefix(userId))).sort()
      .map(name => localStorage.getItem(name) ?? '').join('\n')
  } catch { return '' }
}
export function usePendingSpin(userId: string) {
  const raw = useSyncExternalStore(subscribe, () => snapshot(userId), () => '')
  for (const line of raw.split('\n')) {
    try {
      const parsed = confirmationSchema.safeParse(JSON.parse(line))
      if (parsed.success) return parsed.data
    } catch { /* Ignore unrelated/corrupt storage entries; current month still comes from DB. */ }
  }
  return null
}
export function savePendingSpin(userId: string, confirmation: Confirmation) {
  localStorage.setItem(key(userId, confirmation), JSON.stringify(confirmation))
  window.dispatchEvent(new Event(changed))
}
export function clearPendingSpin(userId: string, original: Confirmation) {
  try {
    localStorage.removeItem(key(userId, original))
    window.dispatchEvent(new Event(changed))
  } catch { /* Retained markers can only replay their original period/operation. */ }
}
