'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import type { LotteryWithStats } from '../types'

interface LotteryRevealProps {
  lottery: LotteryWithStats
  wasParticipant: boolean
}

const LOCALSTORAGE_PREFIX = 'lottery_revealed_'

/**
 * Анимация раскрытия результата лотереи.
 * Показывается на месте баннера, один раз для участников.
 * После анимации записывает в localStorage что юзер уже видел.
 */
export function LotteryReveal({ lottery, wasParticipant }: LotteryRevealProps) {
  const [phase, setPhase] = useState<'hidden' | 'envelope' | 'opening' | 'revealed'>('hidden')
  const [alreadySeen, setAlreadySeen] = useState(true)

  useEffect(() => {
    if (!wasParticipant) return
    const key = LOCALSTORAGE_PREFIX + lottery.id
    const seen = localStorage.getItem(key)
    if (!seen) {
      setAlreadySeen(false)
      setPhase('envelope')
    }
  }, [lottery.id, wasParticipant])

  function handleOpen() {
    setPhase('opening')
    setTimeout(() => {
      setPhase('revealed')
      localStorage.setItem(LOCALSTORAGE_PREFIX + lottery.id, '1')
    }, 1500)
  }

  function handleDismiss() {
    setPhase('hidden')
  }

  if (alreadySeen || phase === 'hidden' || !wasParticipant) return null

  const winner = lottery.winner

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in-up"
      style={{ border: '1px solid var(--apex-border)' }}
    >
      {/* Заголовок */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, var(--apex-gold-dark), var(--apex-gold))' }}
      >
        <span className="text-2xl">🏆</span>
        <div>
          <h2 className="text-white font-bold text-base">Розыгрыш завершён!</h2>
          <p className="text-white/70 text-xs">{lottery.name}</p>
        </div>
      </div>

      {/* Тело с анимацией */}
      <div
        className="p-6 flex flex-col items-center justify-center min-h-[200px]"
        style={{ background: 'var(--surface-elevated)' }}
      >
        <AnimatePresence mode="wait">
          {/* Фаза 1: Конверт закрыт */}
          {phase === 'envelope' && (
            <motion.div
              key="envelope"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-7xl select-none"
              >
                ✉️
              </motion.div>
              <p className="text-sm font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                Победитель определён!
              </p>
              <button
                onClick={handleOpen}
                className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--apex-gold-dark), var(--apex-gold))' }}
              >
                Открыть конверт
              </button>
            </motion.div>
          )}

          {/* Фаза 2: Конверт открывается */}
          {phase === 'opening' && (
            <motion.div
              key="opening"
              initial={{ opacity: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{
                  rotateY: [0, 180, 360],
                  scale: [1, 1.2, 0.5],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
                className="text-7xl select-none"
              >
                ✉️
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 1, 0.5, 1] }}
                transition={{ duration: 1.5 }}
                className="text-sm font-medium"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                Открываем...
              </motion.div>
            </motion.div>
          )}

          {/* Фаза 3: Победитель раскрыт */}
          {phase === 'revealed' && (
            <motion.div
              key="revealed"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              {/* Конфетти-эмодзи */}
              <div className="relative">
                <motion.span
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-5xl block"
                >
                  🎉
                </motion.span>
                {/* Декоративные искорки */}
                {[...Array(6)].map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                    animate={{
                      scale: [0, 1, 0],
                      x: Math.cos((i * 60 * Math.PI) / 180) * 50,
                      y: Math.sin((i * 60 * Math.PI) / 180) * 50,
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-lg"
                  >
                    ✨
                  </motion.span>
                ))}
              </div>

              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                Победитель розыгрыша
              </motion.p>

              <motion.h3
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 150 }}
                className="text-xl font-bold"
                style={{ color: 'var(--apex-primary)' }}
              >
                {winner
                  ? `${winner.first_name} ${winner.last_name}`
                  : 'Неизвестный'}
              </motion.h3>

              {winner?.department && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-sm"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  {winner.department}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex items-center gap-2 mt-1 text-xs"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                <span>🎁 {lottery.name}</span>
                <span>·</span>
                <span>{lottery.total_tickets} билетов</span>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3 }}
                onClick={handleDismiss}
                className="mt-3 px-4 py-2 rounded-full text-xs font-medium transition-colors"
                style={{ color: 'var(--apex-text-secondary)', background: 'var(--surface)' }}
              >
                Закрыть
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
