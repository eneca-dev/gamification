'use client'

import { useState } from 'react'
import { BIMO_ACTIONS } from '../scenes'
import { bimoLook, DEFAULT_EQUIPMENT } from '../types'
import { useBimo } from '../hooks'
import { BimoPortrait } from './BimoPortrait'

export function BimoCompanion({ userId }: { userId: string }) {
  const { data, isError } = useBimo(userId, { refetchOnWindowFocus: true, refetchOnMount: 'always' })
  // Нажатие переключает движение по кругу: кофе → презентация → кристалл.
  // Индекс увеличивается в момент нажатия, поэтому старт — на последнем движении.
  const [actionIndex, setActionIndex] = useState(BIMO_ACTIONS.length - 1)

  return (
    <BimoPortrait
      {...bimoLook(isError ? DEFAULT_EQUIPMENT : data?.equipment ?? DEFAULT_EQUIPMENT)}
      actionIndex={actionIndex}
      onPlay={() => setActionIndex(index => (index + 1) % BIMO_ACTIONS.length)}
    />
  )
}
