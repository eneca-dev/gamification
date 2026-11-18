import { afterEach, expect, it, vi } from 'vitest'
import { broadcastInvalidation, subscribeInvalidation } from '@/modules/cache/client/cross-tab'

afterEach(() => vi.unstubAllGlobals())
it('ignores its own sender and accepts another tab without broadcasting again', () => {
  const instances: FakeChannel[] = []
  class FakeChannel {
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null
    close = vi.fn()
    constructor() { instances.push(this) }
    postMessage(data: unknown) {
      for (const instance of instances) if (instance !== this) instance.onmessage?.({ data } as MessageEvent)
    }
  }
  vi.stubGlobal('BroadcastChannel', FakeChannel)
  const callback = vi.fn()
  const unsubscribe = subscribeInvalidation(callback)
  broadcastInvalidation([['balance']])
  expect(callback).not.toHaveBeenCalled()
  instances[0].onmessage?.({ data: { sender: 'other-tab', keys: [['balance']] } } as MessageEvent)
  expect(callback).toHaveBeenCalledWith([['balance']])
  unsubscribe()
  expect(instances[0].close).toHaveBeenCalledOnce()
})
it('does not crash QueryProvider when channels are forbidden', () => {
  vi.stubGlobal('BroadcastChannel', class { constructor() { throw new Error('forbidden') } })
  expect(() => subscribeInvalidation(() => {})()).not.toThrow()
  expect(() => broadcastInvalidation([['balance']])).not.toThrow()
})
