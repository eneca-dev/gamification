// Типы
export type { ActionResult, PaginatedActionResult } from './types'

// Query Client
export { createQueryClient, staleTimePresets } from './client/query-client'

// Query Keys
export { queryKeys } from './keys/query-keys'
export type { QueryKeys } from './keys/query-keys'

// Provider
export { QueryProvider } from './providers/query-provider'

// Hook Factories
export {
  createCacheQuery,
  createSimpleCacheQuery,
  createDetailCacheQuery,
  createCacheMutation,
  createUpdateMutation,
  createDeleteMutation,
} from './hooks'

// Server Action Utilities
export { safeAction } from './actions/base'
export { isSuccess, unwrapResult } from './utils/action-helpers'

// Realtime
export { realtimeSubscriptions } from './realtime'
export type { TableSubscription } from './realtime'
