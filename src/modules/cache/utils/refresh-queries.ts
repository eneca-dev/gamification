import type { QueryClient } from '@tanstack/react-query'
import { broadcastInvalidation } from '../client/cross-tab'

/**
 * Cancel even an initial request (invalidateQueries alone may reuse it).
 * Its eventual network response must not replace a post-mutation read.
 */
export async function refreshQueries(
  client: QueryClient,
  keys: readonly (readonly unknown[])[],
  broadcast = true,
): Promise<void> {
  await Promise.all(keys.map(queryKey => client.cancelQueries({ queryKey })))
  try {
    await Promise.all(keys.map(queryKey =>
      client.invalidateQueries({ queryKey }, { throwOnError: true }),
    ))
  } finally {
    if (broadcast) broadcastInvalidation(keys)
  }
}

/** A committed mutation cannot become a failed mutation because rendering/refetch failed. */
export async function afterCommit(effects: readonly (() => unknown)[]): Promise<void> {
  const results = await Promise.allSettled(effects.map(effect => Promise.resolve().then(effect)))
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Post-commit update failed:', result.reason)
    }
  }
}
