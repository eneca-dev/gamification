export interface ActionFailure {
  success: false
  error: string
  code?: string
}

export type ActionResult<T> =
  | { success: true; data: T }
  | ActionFailure

export type PaginatedActionResult<T> =
  | { success: true; data: T[]; total: number; page: number; pageSize: number }
  | ActionFailure
