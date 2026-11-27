'use client'

import { BimoStill, BimoTintLayer, bimoLook } from '@/modules/bimo-rig/index.client'
import type { BimoLook } from '@/modules/bimo-rig'
import { useBimo } from '../hooks'
import { useBimoPreview } from '../preview'

/**
 * Плашка «Бимо-шоп» в магазине: мини-Бимо и подложка в цвет его фона.
 * Во время примерки плашка меняется вместе с витриной и боковым меню, иначе
 * рядом оказались бы два разных образа. Серверный образ приходит пропсом
 * и показывается, пока клиентский запрос не ответил.
 */
interface BimoTabLookProps {
  userId: string
  /** Образ со страницы: первый кадр до ответа клиентского запроса. */
  initialLook: BimoLook
  initialBackground: string | null
}

function useTabLook({ userId, initialLook, initialBackground }: BimoTabLookProps): { look: BimoLook; background: string | null } {
  const { data } = useBimo(userId)
  const preview = useBimoPreview()
  const equipment = preview ?? data?.equipment
  if (!equipment) return { look: initialLook, background: initialBackground }
  return { look: bimoLook(equipment, data?.catalogArt), background: equipment.background }
}

export function BimoTabIcon(props: BimoTabLookProps) {
  const { look } = useTabLook(props)
  return <BimoStill {...look} compact alt="" idPrefix="bimo-store-tab" />
}

export function BimoTabTint(props: BimoTabLookProps) {
  const { look, background } = useTabLook(props)
  return <BimoTintLayer backgroundKey={background} backgroundSrc={look.backgroundSrc} />
}
