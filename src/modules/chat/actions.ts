'use server'

import { z } from 'zod'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'
import type { ActionResult } from '@/modules/cache'

import type { ChatMessage } from './types'

const SendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Сообщение не может быть пустым').max(2000),
})

export async function checkChatAvailability(): Promise<boolean> {
  const agentUrl = process.env.CHAT_AGENT_URL
  if (!agentUrl) return false
  try {
    await fetch(agentUrl, { signal: AbortSignal.timeout(3000) })
    return true
  } catch {
    return false
  }
}

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

export async function clearMessages(): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Необходима авторизация' }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('chat_messages').delete().eq('user_id', user.id)

  if (error) return { success: false, error: 'Ошибка очистки чата' }
  return { success: true, data: null }
}

export async function getChatMessagesAction(): Promise<ActionResult<ChatMessage[]>> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Необходима авторизация' }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, user_id, role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) return { success: false, error: 'Ошибка загрузки истории' }
  return { success: true, data: (data ?? []) as ChatMessage[] }
}
