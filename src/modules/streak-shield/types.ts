export type ShieldType = 'ws' | 'revit'

export const FREE_SHIELDS_PER_MONTH = 2

// Pending-данные для UI (предупреждение + таймер)
export interface PendingReset {
  type: ShieldType
  pendingResetDate: string
  expiresAt: string
  currentStreak: number
  price: number
  productId: string
  freeUsesLeft: number
}

// Квота бесплатных жизней на текущий месяц
export interface ShieldQuota {
  ws: { freeUsed: number; paidUsed: number; freeLeft: number }
  revit: { freeUsed: number; paidUsed: number; freeLeft: number }
}

// Запись лога для админки
export interface ShieldLogEntry {
  id: string
  userId: string
  userName: string
  userEmail: string
  shieldType: ShieldType
  protectedDate: string
  createdAt: string
  notes?: string | null
}
