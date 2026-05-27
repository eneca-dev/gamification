'use server'

import { z } from 'zod'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'
import type { ActionResult } from '@/modules/cache'

const SendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Сообщение не может быть пустым').max(2000),
})

export async function sendMessage(
  input: { content: string }
): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Необходима авторизация' }

  const parsed = SendMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Невалидные данные' }
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'user',
    content: parsed.data.content,
  })

  if (error) return { success: false, error: 'Ошибка отправки сообщения' }

  // Нет revalidatePath — Realtime обновит клиент
  return { success: true, data: null }
}
