export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export type PaginatedActionResult<T> =
  | { success: true; data: T[]; total: number; page: number; pageSize: number }
  | { success: false; error: string }
