import type { ActionResult, ActionFailure } from '../types'

export class ActionError extends Error {
  readonly code?: string

  constructor(failure: ActionFailure) {
    super(failure.error)
    this.name = 'ActionError'
    this.code = failure.code
  }
}

export function isSuccess<T>(result: ActionResult<T>): result is { success: true; data: T } {
  return result.success === true
}

export function unwrapResult<T>(result: ActionResult<T>): T {
  if (!result.success) throw new ActionError(result)
  return result.data
}
