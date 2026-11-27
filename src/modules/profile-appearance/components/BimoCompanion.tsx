'use client'

import { BimoStage, DEFAULT_EQUIPMENT, bimoLook } from '@/modules/bimo-rig/index.client'
import { useBimo } from '../hooks'
import { useBimoPreview } from '../preview'

export function BimoCompanion({ userId }: { userId: string }) {
  // Сбойный фоновый refetch не гасит уже загруженный образ: он остаётся
  // в кэше, а стандартный нужен только пока данных нет вообще. Иначе разовая
  // сетевая ошибка перекрашивала меню и Бимо в мятный.
  const { data } = useBimo(userId, { refetchOnWindowFocus: true })
  // Примерка в магазине действует и здесь, иначе Бимо в меню стоял бы
  // в одном образе, а подложка вокруг него — уже в примеряемом.
  const preview = useBimoPreview()
  const look = bimoLook(preview ?? data?.equipment ?? DEFAULT_EQUIPMENT, data?.catalogArt)
  // Своей подложки у блока нет: всё меню уже залито тем же фоном
  // (BimoSidebarBackdrop), поэтому арка сливается с ним без шва и рамки.
  return (
    <div className="px-4">
      <BimoStage {...look} interactive idPrefix={`bimo-sidebar-${userId}`} />
    </div>
  )
}
