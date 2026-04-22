'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'

import type { OnboardingStep, StepPlacement } from '../types'

interface OnboardingSpotlightProps {
  step: OnboardingStep
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
}

interface TooltipPosition {
  top: number
  left: number
  placement: StepPlacement
}

/** Отступ между target и tooltip */
const GAP = 16
/** Padding вокруг подсвеченного элемента */
const HIGHLIGHT_PADDING = 8
/** Таймаут ожидания target элемента в DOM */
const TARGET_WAIT_TIMEOUT = 3000
/** Интервал проверки target */
const TARGET_POLL_INTERVAL = 200
/** Таймаут завершения скролла */
const SCROLL_SETTLE_TIMEOUT = 600

export function OnboardingSpotlight({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: OnboardingSpotlightProps) {
  const router = useRouter()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [ready, setReady] = useState(false)

  const isModal = step.target === null
  const isLastStep = stepIndex === totalSteps - 1

  // Поиск target элемента в DOM с polling
  useEffect(() => {
    setReady(false)
    setTargetEl(null)
    setTargetRect(null)
    setTooltipPos(null)

    // Подготовить DOM перед поиском target (переключить таб, перейти на страницу и т.п.)
    step.onBeforeShow?.({ router })

    if (isModal) {
      setReady(true)
      return
    }

    const startTime = Date.now()

    const poll = setInterval(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-onboarding="${step.target}"]`
      )
      if (el) {
        clearInterval(poll)
        setTargetEl(el)
        return
      }
      // Таймаут — пропускаем шаг
      if (Date.now() - startTime > TARGET_WAIT_TIMEOUT) {
        clearInterval(poll)
        onNext()
      }
    }, TARGET_POLL_INTERVAL)

    return () => clearInterval(poll)
  }, [step.id, step.target, step.onBeforeShow, isModal, onNext, router])

  // Скролл к элементу и расчёт позиции
  useLayoutEffect(() => {
    if (isModal || !targetEl) return

    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const timer = setTimeout(() => {
      const rect = targetEl.getBoundingClientRect()
      setTargetRect(rect)
      setReady(true)
    }, SCROLL_SETTLE_TIMEOUT)

    return () => clearTimeout(timer)
  }, [targetEl, isModal])

  // Расчёт позиции tooltip после рендера
  useLayoutEffect(() => {
    if (!ready || isModal || !targetRect || !tooltipRef.current) return

    const tooltip = tooltipRef.current
    const tooltipW = tooltip.offsetWidth
    const tooltipH = tooltip.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    const pos = calculatePosition(
      targetRect,
      tooltipW,
      tooltipH,
      vw,
      vh,
      step.placement
    )
    setTooltipPos(pos)
  }, [ready, targetRect, isModal, step.placement])

  // Обновление rect при resize / scroll
  useEffect(() => {
    if (!targetEl || isModal) return

    const update = () => {
      const rect = targetEl.getBoundingClientRect()
      setTargetRect(rect)
    }

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [targetEl, isModal])

  // Блокировка скролла body (сохраняем оригинальное значение)
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Escape для пропуска
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onSkip])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onNext()
      }
    },
    [onNext]
  )

  if (!ready) return null

  // Модалка по центру (шаги без target)
  if (isModal) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={handleOverlayClick}>
        <div className="fixed inset-0 bg-black/60" />
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`onboarding-title-${step.id}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-[10002] w-full max-w-md rounded-2xl p-6"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--apex-border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onSkip}
              aria-label="Закрыть подсказку"
              className="absolute top-3 right-3 p-1.5 rounded-full transition-colors hover:bg-black/5"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>

            <div id={`onboarding-title-${step.id}`} className="text-base font-bold mb-2" style={{ color: 'var(--apex-text)' }}>
              {step.title}
            </div>
            <div className="text-[13px] leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
              {step.description}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {stepIndex + 1} / {totalSteps}
              </span>
              <div className="flex items-center gap-3">
                {!isLastStep && (
                  <button
                    onClick={onSkip}
                    className="text-[12px] font-medium transition-colors hover:underline"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Пропустить
                  </button>
                )}
                <button
                  onClick={onNext}
                  className="px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-colors"
                  style={{ background: 'var(--apex-primary)' }}
                >
                  {isLastStep ? 'Понятно' : 'Далее'}
                  {!isLastStep && <ChevronRight size={14} className="inline ml-0.5 -mt-px" />}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // Spotlight с target
  if (!targetRect) return null

  const highlightStyle = {
    position: 'fixed' as const,
    top: targetRect.top - HIGHLIGHT_PADDING,
    left: targetRect.left - HIGHLIGHT_PADDING,
    width: targetRect.width + HIGHLIGHT_PADDING * 2,
    height: targetRect.height + HIGHLIGHT_PADDING * 2,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
    zIndex: 10001,
    pointerEvents: 'none' as const,
  }

  return (
    <div className="fixed inset-0 z-[10000]" onClick={handleOverlayClick}>
      {/* Highlight вокруг target */}
      <div style={highlightStyle} />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={tooltipRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`onboarding-title-${step.id}`}
          initial={{ opacity: 0, y: tooltipPos?.placement === 'top' ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed z-[10002] w-[340px] rounded-xl p-4"
          style={{
            top: tooltipPos?.top ?? -9999,
            left: tooltipPos?.left ?? -9999,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            visibility: tooltipPos ? 'visible' : 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onSkip}
            aria-label="Закрыть подсказку"
            className="absolute top-2.5 right-2.5 p-1 rounded-full transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>

          <div id={`onboarding-title-${step.id}`} className="text-[14px] font-bold mb-1.5 pr-6" style={{ color: 'var(--apex-text)' }}>
            {step.title}
          </div>
          <div className="text-[12px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {step.description}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {stepIndex + 1} / {totalSteps}
            </span>
            <div className="flex items-center gap-3">
              {!isLastStep && (
                <button
                  onClick={onSkip}
                  className="text-[11px] font-medium transition-colors hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Пропустить
                </button>
              )}
              <button
                onClick={onNext}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold text-white transition-colors"
                style={{ background: 'var(--apex-primary)' }}
              >
                {isLastStep ? 'Понятно' : 'Далее'}
                {!isLastStep && <ChevronRight size={12} className="inline ml-0.5 -mt-px" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Расчёт позиции tooltip с учётом границ viewport */
function calculatePosition(
  targetRect: DOMRect,
  tooltipW: number,
  tooltipH: number,
  viewportW: number,
  viewportH: number,
  preferred: StepPlacement
): TooltipPosition {
  const placements: StepPlacement[] = [preferred, 'bottom', 'top', 'right', 'left']

  for (const placement of placements) {
    const pos = getPositionForPlacement(targetRect, tooltipW, tooltipH, placement)

    // Проверяем, вписывается ли в viewport
    if (
      pos.top >= 8 &&
      pos.left >= 8 &&
      pos.top + tooltipH <= viewportH - 8 &&
      pos.left + tooltipW <= viewportW - 8
    ) {
      return { ...pos, placement }
    }
  }

  // Fallback: под target, ограничено viewport
  return {
    top: Math.min(
      Math.max(8, targetRect.bottom + GAP),
      viewportH - tooltipH - 8
    ),
    left: Math.min(
      Math.max(8, targetRect.left + targetRect.width / 2 - tooltipW / 2),
      viewportW - tooltipW - 8
    ),
    placement: 'bottom',
  }
}

function getPositionForPlacement(
  rect: DOMRect,
  tooltipW: number,
  tooltipH: number,
  placement: StepPlacement
): { top: number; left: number } {
  const centerX = rect.left + rect.width / 2 - tooltipW / 2
  const centerY = rect.top + rect.height / 2 - tooltipH / 2

  switch (placement) {
    case 'top':
      return { top: rect.top - HIGHLIGHT_PADDING - GAP - tooltipH, left: centerX }
    case 'bottom':
      return { top: rect.bottom + HIGHLIGHT_PADDING + GAP, left: centerX }
    case 'left':
      return { top: centerY, left: rect.left - HIGHLIGHT_PADDING - GAP - tooltipW }
    case 'right':
      return { top: centerY, left: rect.right + HIGHLIGHT_PADDING + GAP }
    case 'center':
      return { top: centerY, left: centerX }
  }
}
