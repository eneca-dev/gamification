import type { ActionResult } from '../types'

/**
 * Type guard — сужает тип до успешного результата.
 */
export function isSuccess<T>(result: ActionResult<T>): result is { success: true; data: T } {
  return result.success === true
}

/**
 * Извлекает данные или бросает ошибку.
 * Использовать там, где ошибка ActionResult — исключительная ситуация.
 */
export function unwrapResult<T>(result: ActionResult<T>): T {
  if (!result.success) throw new Error(result.error)
  return result.data
}
