const PREFIX = 'onboarding_v1'

function buildKey(userId: string, pageSlug: string): string {
  return `${PREFIX}:${userId}:${pageSlug}`
}

/** Проверить, показывался ли тур (ключ существует = тур уже был) */
export function isTourSeen(userId: string, pageSlug: string): boolean {
  try {
    return localStorage.getItem(buildKey(userId, pageSlug)) !== null
  } catch {
    return false
  }
}

/** Пометить тур как показанный — вызывается ПЕРЕД первым шагом */
export function markTourSeen(userId: string, pageSlug: string): void {
  try {
    localStorage.setItem(buildKey(userId, pageSlug), '1')
  } catch {
    // localStorage недоступен
  }
}

/** Сбросить тур (dev mode) */
export function resetTour(userId: string, pageSlug: string): void {
  try {
    localStorage.removeItem(buildKey(userId, pageSlug))
  } catch {
    // noop
  }
}

/** Сбросить все туры пользователя (dev mode) */
export function resetAllTours(userId: string): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${PREFIX}:${userId}:`)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch {
    // noop
  }
}
