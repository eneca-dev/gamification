import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { clearPendingSpin, savePendingSpin, usePendingSpin } from '@/modules/roulette/pending'
const old = { token: 'old-signed-token', operationId: '12345678-1234-4123-8123-123456789012', period: '2026-11', balance: 1000 }
const next = { ...old, token: 'new-signed-token', operationId: '22345678-1234-4123-8123-123456789012', period: '2026-12' }
beforeEach(() => localStorage.clear())
it('a delayed old response cannot erase the new month operation', () => {
  const { result } = renderHook(() => usePendingSpin('user'))
  act(() => { savePendingSpin('user', old); savePendingSpin('user', next) })
  expect(result.current).toEqual(old)
  act(() => clearPendingSpin('user', old))
  expect(result.current).toEqual(next)
  act(() => clearPendingSpin('user', old))
  expect(result.current).toEqual(next)
})
it('keeps different requests and different users independently', () => {
  savePendingSpin('user', old)
  savePendingSpin('other-user', next)
  const otherRequest = { ...next, period: old.period }
  savePendingSpin('user', otherRequest)
  clearPendingSpin('user', old)
  const { result } = renderHook(() => usePendingSpin('user'))
  expect(result.current).toEqual(otherRequest)
})
