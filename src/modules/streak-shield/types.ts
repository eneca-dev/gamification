export type ShieldType = 'ws' | 'revit'

// Pending-данные для UI (предупреждение + таймер)
export interface PendingReset {
  type: ShieldType
  pendingResetDate: string
  expiresAt: string
  currentStreak: number
  price: number
  productId: string
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
