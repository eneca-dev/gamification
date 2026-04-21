'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/modules/cache/keys/query-keys'
import { fetchMyGratitudes, fetchCompanyGratitudes, fetchSenderQuota } from '../actions.client'
import { sendGratitude } from '../actions'

import type { GratitudeNew, SenderQuota, SendGratitudeInput } from '../types'

/** Благодарности текущего пользователя */
export function useMyGratitudes(userEmail: string, initialData?: GratitudeNew[]) {
  return useQuery({
    queryKey: queryKeys.gratitudes.my(userEmail),
    queryFn: () => fetchMyGratitudes(userEmail, 30),
    initialData,
    staleTime: 60_000,
  })
}

/** Лента компании за 2 недели */
export function useCompanyGratitudes(initialData?: GratitudeNew[]) {
  return useQuery({
    queryKey: queryKeys.gratitudes.feed(),
    queryFn: () => fetchCompanyGratitudes(100),
    initialData,
    staleTime: 60_000,
  })
}

/** Квота отправителя */
export function useSenderQuota(senderId: string, initialData?: SenderQuota) {
  return useQuery({
    queryKey: queryKeys.gratitudes.quota(senderId),
    queryFn: () => fetchSenderQuota(senderId),
    initialData,
    staleTime: 30_000,
  })
}

/** Отправка благодарности с оптимистик апдейтом */
export function useSendGratitude(senderId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SendGratitudeInput) => sendGratitude(senderId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gratitudes.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.balance.all })
    },
  })
}
