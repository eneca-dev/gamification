type EventSource = { source: string | null }

export function eventSource(event: EventSource | EventSource[] | null): string | null {
  if (!Array.isArray(event)) return event?.source ?? null
  if (event.length > 1) throw new Error('A transaction must reference at most one event')
  return event[0]?.source ?? null
}

export function transactionMetrics(coins: number, source: string | null): { earned: number; spent: number } {
  return {
    earned: coins > 0 && source !== 'roulette' ? coins : 0,
    spent: coins < 0 ? -coins : 0,
  }
}
