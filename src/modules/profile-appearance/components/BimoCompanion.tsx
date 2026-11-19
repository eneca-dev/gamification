'use client'

import { BimoStage, DEFAULT_EQUIPMENT, bimoLook } from '@/modules/bimo-rig/index.client'
import { useBimo } from '../hooks'

export function BimoCompanion({ userId }: { userId: string }) {
  const { data, isError } = useBimo(userId, { refetchOnWindowFocus: true })
  return <BimoStage {...bimoLook(isError ? DEFAULT_EQUIPMENT : data?.equipment ?? DEFAULT_EQUIPMENT, data?.catalogArt)} interactive idPrefix={`bimo-sidebar-${userId}`} />
}
