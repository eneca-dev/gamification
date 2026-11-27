'use client'

import { useSyncExternalStore } from 'react'
import type { BimoEquipment } from '@/modules/bimo-rig'

// Примерка живёт вне дерева: витрина магазина задаёт её, а боковое меню
// подхватывает, хотя стоит в layout и общего родителя с витриной не имеет.
// Тот же приём, что у отметки просмотра выходных в сайдбаре: подписка
// через useSyncExternalStore вместо провайдера на всё приложение.
// Состояние намеренно не сохраняется: перезагрузка возвращает надетый образ.

let preview: BimoEquipment | null = null
const listeners = new Set<() => void>()

export function setBimoPreview(next: BimoEquipment | null): void {
  if (preview === next) return
  preview = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const read = () => preview
/** На сервере примерки нет: первый кадр совпадает с надетым образом. */
const readServer = () => null

/** Примеряемый образ или `null`, когда примерка не идёт. */
export function useBimoPreview(): BimoEquipment | null {
  return useSyncExternalStore(subscribe, read, readServer)
}
