import { bimoTint } from '../decor'

/**
 * Подложка в цвет надетого фона. Один рецепт на боковое меню и полосу
 * витрины: тон-токен, поверх него размытый рисунок фона вполсилы, сверху
 * вуаль. Половинная прозрачность рисунка нужна подписям меню: на полной
 * тёмные участки звёздного вечера уводят контраст ниже 4.5:1.
 * Слой декоративный, поэтому скрыт от скринридера и не ловит нажатия.
 */
interface BimoTintLayerProps {
  /** Ключ надетого фона из каталога; пустой — мятный тон. */
  backgroundKey?: string | null
  backgroundSrc?: string | null
  /** Полоса витрины растворяется сверху и снизу; меню залито целиком. */
  fade?: boolean
}

export function BimoTintLayer({ backgroundKey, backgroundSrc, fade = false }: BimoTintLayerProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-colors duration-300 ${fade ? 'bimo-band-fade' : ''}`}
      style={{ background: bimoTint(backgroundKey) }}
    >
      {backgroundSrc && (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-2xl"
          style={{ backgroundImage: `url(${backgroundSrc})` }}
        />
      )}
      <div className="bimo-band-veil absolute inset-0" />
    </div>
  )
}
