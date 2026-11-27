'use client'

import { BimoDecor, BimoTintLayer, DEFAULT_EQUIPMENT, bimoDecor, bimoLook } from '@/modules/bimo-rig/index.client'
import { useBimo } from '../hooks'
import { useBimoPreview } from '../preview'

/**
 * Подложка бокового меню: тон надетого фона Бимо и его эмодзи по всей высоте.
 * Рецепт подложки тот же, что у полосы витрины, поэтому на странице магазина
 * меню и полоса дают один цвет и сливаются. Пока в магазине идёт примерка,
 * меню показывает примеряемый фон — так видно, как он будет выглядеть.
 * Слой лежит под содержимым меню, карточки и подписи остаются поверх него.
 * Экипировка берётся из того же запроса, что у BimoCompanion: ключ общий,
 * второго обращения к серверу нет. До ответа виден мятный тон; сбойный фоновый
 * refetch загруженный фон не гасит — он остаётся в кэше.
 */
export function BimoSidebarBackdrop({ userId }: { userId: string }) {
  // Та же опция, что у BimoCompanion: иначе обновление по фокусу пропадало бы
  // в свёрнутом меню, где Бимо не рендерится.
  const { data } = useBimo(userId, { refetchOnWindowFocus: true })
  const preview = useBimoPreview()
  const equipment = preview ?? data?.equipment ?? DEFAULT_EQUIPMENT
  const background = equipment.background
  const item = background ? data?.items.find(entry => entry.assetKey === background) : undefined
  const look = bimoLook(equipment, data?.catalogArt)
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
      <BimoTintLayer backgroundKey={background} backgroundSrc={look.backgroundSrc} />
      <BimoDecor symbols={bimoDecor(item?.decor, item?.emoji)} variant="sidebar" />
    </div>
  )
}
