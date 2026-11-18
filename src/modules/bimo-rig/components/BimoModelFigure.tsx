import { useId } from 'react'
import { armTransform, eyeClosure, EYE_WINDOWS_PATH, gazeTransform, gemTransform, LEFT_PAW_PATH, MODEL_PATH, mouthPath, sampleMotion, SHOULDER_BLEND_PATH } from '../motion'
import type { BimoLook, BimoMotionPose } from '../types'

interface BimoModelFigureProps {
  look: BimoLook
  pose?: BimoMotionPose
  modelScale?: number
  /** Фон можно не рисовать: для мини-превью нужен только персонаж. */
  background?: boolean
  /**
   * Префикс идентификаторов масок и градиентов. Нужен стабильный на сервере
   * и в браузере: `useId` зависит от места в дереве, а оно у разных обёрток
   * расходится и ломает гидратацию. Должен быть уникален в пределах страницы.
   */
  idPrefix?: string
}

export function BimoModelFigure({ look, pose = sampleMotion(0), modelScale = 0.85, background = true, idPrefix }: BimoModelFigureProps) {
  const generated = useId()
  const id = idPrefix ?? generated
  const eyes = eyeClosure(pose.blink)
  const part = (name: string, clipPath?: string) => <image href={`${MODEL_PATH}/${name}.webp`} width={512} height={512} clipPath={clipPath} />
  const item = (src?: string) => src ? <image href={src} width={512} height={512} /> : null
  return <>
    {/* Края фона растворяются. Маска строится из самого рисунка: его альфа
        красится в белый и размывается, поэтому арочная кромка и углы уходят
        в прозрачность плавно, а середина остаётся резкой. */}
    {background && <>
      <defs>
        <filter id={`${id}-background-soften`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          {/* Сжатие маски съедает тёмную обводку арки, размытие растворяет кромку. */}
          <feMorphology operator="erode" radius="12" />
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <mask id={`${id}-background-edges`} maskUnits="userSpaceOnUse" x={0} y={0} width={600} height={500}>
          <image href={look.backgroundSrc} width={600} height={500} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-background-soften)`} />
        </mask>
      </defs>
      <image href={look.backgroundSrc} width={600} height={500} preserveAspectRatio="xMidYMid slice" mask={`url(#${id}-background-edges)`} />
    </>}
    <defs>
      <clipPath id={`${id}-left-paw`}><path d={LEFT_PAW_PATH} /></clipPath>
      <clipPath id={`${id}-eye-interiors`}><path d={EYE_WINDOWS_PATH} /></clipPath>
      <clipPath id={`${id}-blink`}><path data-eye-window="" d={eyes.aperture} /></clipPath>
      <radialGradient id={`${id}-shoulder-blend`} gradientUnits="userSpaceOnUse" cx={275} cy={239} r={27}>
        <stop offset="55%" stopColor="white" /><stop offset="100%" stopColor="white" stopOpacity={0} />
      </radialGradient>
      <mask id={`${id}-shoulder`} maskUnits="userSpaceOnUse" x={254} y={219} width={42} height={56}>
        <path d={SHOULDER_BLEND_PATH} fill={`url(#${id}-shoulder-blend)`} />
      </mask>
    </defs>
    <g transform={`translate(${300 - 256 * modelScale} ${250 - 248 * modelScale}) scale(${modelScale})`} data-bimo-model="4">
      <g data-model="tail" transform={`rotate(${pose.tail} 181 397)`}>{part('tail')}</g>
      {part('body')}
      <g data-model="arm" transform={armTransform(pose)}>
        {part('arm')}
        {item(look.garment?.sleeve)}
      </g>
      {!look.garment && <g mask={`url(#${id}-shoulder)`}>{part('body')}</g>}
      {item(look.garment?.outfit)}
      {look.garment && part('body', `url(#${id}-left-paw)`)}
      {item(look.accessory?.neck)}
      <g data-model="head" transform={`rotate(${pose.head} 256 220)`}>
        {part('head')}
        <g data-model="eye-content" opacity={eyes.eyeOpacity} clipPath={`url(#${id}-blink)`}>
          {part('eyes')}
          <g clipPath={`url(#${id}-eye-interiors)`}>
            <g data-model="pupils" transform={gazeTransform(pose)}>{part('pupils')}</g>
          </g>
        </g>
        <path data-model="eyelids" d={eyes.lid} opacity={eyes.lidOpacity} fill="none" stroke="#191b19" strokeWidth={2.8} strokeLinecap="round" />
        <path data-model="mouth" d={mouthPath(pose)} fill="#513833" stroke="#20211e" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
        {item(look.accessory?.head)}
      </g>
      <g data-model="gem" opacity={pose.gem} transform={gemTransform(pose)}>
        <defs>
          <linearGradient id={`${id}-gem-table`} x2="85%" y2="100%">
            <stop stopColor="#f0ffff" /><stop offset="1" stopColor="#79e9ff" />
          </linearGradient>
          <linearGradient id={`${id}-gem-center`} x2="70%" y2="100%">
            <stop stopColor="#61eaff" /><stop offset="1" stopColor="#237bcd" />
          </linearGradient>
        </defs>
        <path d="M14 15H72L94 43L43 91L-8 43Z" fill="#1676b1" stroke="#155984" strokeWidth={3} strokeLinejoin="round" />
        <path d="M-8 43L14 15L25 43Z" fill="#55c8ed" />
        <path d="M14 15H72L61 43H25Z" fill={`url(#${id}-gem-table)`} />
        <path d="M72 15L94 43H61Z" fill="#39aee2" />
        <path d="M-8 43H25L43 91Z" fill="#279dce" />
        <path d="M25 43H61L43 91Z" fill={`url(#${id}-gem-center)`} />
        <path d="M61 43H94L43 91Z" fill="#225da8" />
        <path d="M14 16L25 43H61L72 16M25 43L43 90" fill="none" stroke="#ddfbff" strokeOpacity={0.75} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M23 21H56M-1 43H15" fill="none" stroke="#f3ffff" strokeWidth={2.5} strokeLinecap="round" />
        <path d="M69 3Q70 14 81 15Q70 16 69 27Q68 16 57 15Q68 14 69 3Z" fill="#fff" />
      </g>
      <g data-model="question" opacity={pose.question} transform={`translate(403 ${103 - 5 * pose.question})`} fill="none" stroke="#14674c" strokeWidth={4.5} strokeLinecap="round">
        <g transform="translate(-5 -8) scale(1.5)">
          <path d="M0 8C0 -2 19 -4 21 7C23 16 10 16 10 25" />
          <circle cx={10} cy={35} r={2.6} fill="#14674c" stroke="none" />
        </g>
      </g>
    </g>
  </>
}
