const CHANNEL = 'gamification-query-invalidation'
// Transport identity only; this is not an operation ID or authorization token.
const sender = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36)

export function broadcastInvalidation(keys: readonly (readonly unknown[])[]) {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage({ sender, keys })
    channel.close()
  } catch { /* Polling and authoritative recovery remain available. */ }
}
export function subscribeInvalidation(callback: (keys: readonly (readonly unknown[])[]) => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return
      const message = event.data as { sender?: unknown; keys?: unknown }
      if (message.sender === sender || typeof message.sender !== 'string') return
      if (Array.isArray(message.keys) && message.keys.length <= 32 && message.keys.every(Array.isArray)) {
        callback(message.keys)
      }
    }
    return () => channel.close()
  } catch { return () => {} }
}
