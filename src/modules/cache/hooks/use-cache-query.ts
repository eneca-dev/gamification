'use client'

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import type { ActionResult } from '../types'

interface CreateCacheQueryOptions<TData, TFilters> {
  queryKey: (filters: TFilters) => readonly unknown[]
  queryFn: (filters: TFilters) => Promise<ActionResult<TData>>
  staleTime?: number
}

/**
 * Фабрика для query хуков с фильтрами.
 */
export function createCacheQuery<TData, TFilters = void>(
  options: CreateCacheQueryOptions<TData, TFilters>
) {
  return function useCacheQuery(
    filters: TFilters,
    queryOptions?: Partial<UseQueryOptions<TData>>
  ) {
    return useQuery<TData>({
      queryKey: options.queryKey(filters),
      queryFn: async () => {
        const result = await options.queryFn(filters)
        if (!result.success) throw new Error(result.error)
        return result.data
      },
      staleTime: options.staleTime,
      ...queryOptions,
    })
  }
}

interface CreateSimpleCacheQueryOptions<TData> {
  queryKey: readonly unknown[]
  queryFn: () => Promise<ActionResult<TData>>
  staleTime?: number
}

/**
 * Фабрика для query хуков без фильтров.
 */
export function createSimpleCacheQuery<TData>(
  options: CreateSimpleCacheQueryOptions<TData>
) {
  return function useCacheQuery(queryOptions?: Partial<UseQueryOptions<TData>>) {
    return useQuery<TData>({
      queryKey: options.queryKey,
      queryFn: async () => {
        const result = await options.queryFn()
        if (!result.success) throw new Error(result.error)
        return result.data
      },
      staleTime: options.staleTime,
      ...queryOptions,
    })
  }
}

interface CreateDetailCacheQueryOptions<TData> {
  queryKey: (id: string) => readonly unknown[]
  queryFn: (id: string) => Promise<ActionResult<TData>>
  staleTime?: number
}

/**
 * Фабрика для query хуков по ID.
 * Если id === undefined — запрос не выполняется.
 */
export function createDetailCacheQuery<TData>(
  options: CreateDetailCacheQueryOptions<TData>
) {
  return function useCacheQuery(
    id: string | undefined,
    queryOptions?: Partial<UseQueryOptions<TData>>
  ) {
    return useQuery<TData>({
      queryKey: id ? options.queryKey(id) : ['__disabled__'],
      queryFn: async () => {
        if (!id) throw new Error('ID не указан')
        const result = await options.queryFn(id)
        if (!result.success) throw new Error(result.error)
        return result.data
      },
      enabled: Boolean(id),
      staleTime: options.staleTime,
      ...queryOptions,
    })
  }
}
