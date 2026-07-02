'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/modules/cache/keys/query-keys'
import { fetchMyGratitudes, fetchCompanyGratitudes, fetchSenderQuota } from '../actions.client'
import { sendGratitude } from '../actions'

import type { GratitudeNew, SenderQuota, SendGratitudeInput } from '../types'

// refetchOnWindowFocus — страховка на случай обрыва realtime-соединения
// (глобально фокус-рефетч выключен в query-client)

/** Благодарности текущего пользователя */
export function useMyGratitudes(userEmail: string, initialData?: GratitudeNew[], limit = 30) {
  return useQuery({
    queryKey: queryKeys.gratitudes.my(userEmail, limit),
    queryFn: () => fetchMyGratitudes(userEmail, limit),
    initialData,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Лента компании за 2 недели */
export function useCompanyGratitudes(initialData?: GratitudeNew[]) {
  return useQuery({
    queryKey: queryKeys.gratitudes.feed(),
    queryFn: () => fetchCompanyGratitudes(100),
    initialData,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Квота отправителя */
export function useSenderQuota(senderId: string, initialData?: SenderQuota) {
  return useQuery({
    queryKey: queryKeys.gratitudes.quota(senderId),
    queryFn: () => fetchSenderQuota(senderId),
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}

/** Отправка благодарности. Инвалидирует ленты и баланс при успехе */
export function useSendGratitude(senderId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SendGratitudeInput) => sendGratitude(senderId, input),
    // Без 'always' офлайн-мутация ставится на паузу вместо ошибки —
    // оптимистичный экран успеха никогда не откатится
    networkMode: 'always',
    onSuccess: (result) => {
      if (!result.success) return
      queryClient.invalidateQueries({ queryKey: queryKeys.gratitudes.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.balance.all })
    },
  })
}
