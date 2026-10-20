import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'

/** Квота Supabase Pro: 100 ГБ. При смене плана — изменить константу. */
export const STORAGE_PLAN_BYTES = 100 * 1024 ** 3
/** Soft-лимит: по достижении блокируем новые загрузки. */
export const STORAGE_SOFT_LIMIT = 0.70
export const STORAGE_SOFT_LIMIT_BYTES = Math.floor(STORAGE_PLAN_BYTES * STORAGE_SOFT_LIMIT)

async function _getUsedBytes(): Promise<number> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_storage_used_bytes')
  if (error) throw new Error('Не удалось проверить свободное место в хранилище')
  const used = Number(data)
  if (data == null || !Number.isFinite(used) || used < 0) {
    throw new Error('Не удалось проверить свободное место в хранилище')
  }
  return used
}

/** Текущий объём занятого Storage по всем bucket'ам. Кэш 5 минут. */
export const getStorageUsedBytes = cached(_getUsedBytes, ['storage-used-bytes'], {
  tags: ['storage-used-bytes'],
  revalidate: CACHE_5M,
})

/** Проверка: можно ли ещё загрузить файл размера `additionalBytes`.
 *  При превышении soft-лимита кидает Error с человекочитаемым сообщением. */
export async function assertCanUpload(additionalBytes: number): Promise<void> {
  const used = await getStorageUsedBytes()
  const projected = used + additionalBytes
  if (projected > STORAGE_SOFT_LIMIT_BYTES) {
    const usedPct = Math.round((used / STORAGE_PLAN_BYTES) * 100)
    throw new Error(
      `Хранилище заполнено на ${usedPct}% (лимит ${Math.round(STORAGE_SOFT_LIMIT * 100)}%). ` +
      `Загрузки приостановлены. Освободите место или обратитесь к администратору.`,
    )
  }
}
