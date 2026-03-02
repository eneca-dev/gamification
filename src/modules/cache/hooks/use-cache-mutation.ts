'use client'

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import type { ActionResult } from '../types'

interface CreateCacheMutationOptions<TInput, TData> {
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>
  invalidateKeys?: readonly (readonly unknown[])[]
  onSuccess?: (data: TData) => void
}

/**
 * Базовая фабрика для mutation хуков с инвалидацией кэша.
 */
export function createCacheMutation<TInput, TData>(
  options: CreateCacheMutationOptions<TInput, TData>
) {
  return function useCacheMutation(
    mutationOptions?: Partial<UseMutationOptions<TData, Error, TInput>>
  ) {
    const queryClient = useQueryClient()

    return useMutation<TData, Error, TInput>({
      mutationFn: async (input) => {
        const result = await options.mutationFn(input)
        if (!result.success) throw new Error(result.error)
        return result.data
      },
      onSuccess: (data) => {
        options.invalidateKeys?.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key })
        })
        options.onSuccess?.(data)
      },
      ...mutationOptions,
    })
  }
}

interface CreateUpdateMutationOptions<
  TInput extends { id: string },
  TData extends { id: string },
> {
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>
  listQueryKey: readonly unknown[]
  merge: (item: TData, input: TInput) => TData
  invalidateKeys?: readonly (readonly unknown[])[]
}

/**
 * Фабрика для mutation обновления с оптимистичным обновлением списка.
 */
export function createUpdateMutation<
  TInput extends { id: string },
  TData extends { id: string },
>(options: CreateUpdateMutationOptions<TInput, TData>) {
  return function useUpdateMutation() {
    const queryClient = useQueryClient()

    return useMutation<TData, Error, TInput, { previous: TData[] | undefined }>({
      mutationFn: async (input) => {
        const result = await options.mutationFn(input)
        if (!result.success) throw new Error(result.error)
        return result.data
      },
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: options.listQueryKey })
        const previous = queryClient.getQueryData<TData[]>(options.listQueryKey)
        queryClient.setQueryData<TData[]>(options.listQueryKey, (old) =>
          old?.map((item) => (item.id === input.id ? options.merge(item, input) : item))
        )
        return { previous }
      },
      onError: (_err, _input, context) => {
        if (context?.previous) {
          queryClient.setQueryData(options.listQueryKey, context.previous)
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: options.listQueryKey })
        options.invalidateKeys?.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key })
        })
      },
    })
  }
}

interface CreateDeleteMutationOptions<
  TInput extends { id: string },
  TData extends { id: string },
> {
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>
  listQueryKey: readonly unknown[]
  invalidateKeys?: readonly (readonly unknown[])[]
}

/**
 * Фабрика для mutation удаления с оптимистичным обновлением списка.
 */
export function createDeleteMutation<
  TInput extends { id: string },
  TData extends { id: string },
>(options: CreateDeleteMutationOptions<TInput, TData>) {
  return function useDeleteMutation() {
    const queryClient = useQueryClient()

    return useMutation<TData, Error, TInput, { previous: TData[] | undefined }>({
      mutationFn: async (input) => {
        const result = await options.mutationFn(input)
        if (!result.success) throw new Error(result.error)
        return result.data
      },
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: options.listQueryKey })
        const previous = queryClient.getQueryData<TData[]>(options.listQueryKey)
        queryClient.setQueryData<TData[]>(options.listQueryKey, (old) =>
          old?.filter((item) => item.id !== input.id)
        )
        return { previous }
      },
      onError: (_err, _input, context) => {
        if (context?.previous) {
          queryClient.setQueryData(options.listQueryKey, context.previous)
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: options.listQueryKey })
        options.invalidateKeys?.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key })
        })
      },
    })
  }
}
