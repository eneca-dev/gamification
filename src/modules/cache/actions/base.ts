import type { ActionResult } from '../types'

/**
 * Обёртка для перехвата исключений в Server Actions.
 * Оборачивает всю логику action и возвращает ActionResult вместо throw.
 */
export async function safeAction<T>(
  fn: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return { success: false, error: message }
  }
}
