import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth'
import { ChatWindow } from '@/modules/chat/index.client'
import { getChatMessages } from '@/modules/chat/queries'

export default async function ChatPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const messages = await getChatMessages()

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-[20px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Ассистент
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--apex-text-muted)' }}>
          Ответы на вопросы о правилах геймификации
        </p>
      </div>

      <div
        className="flex-1 rounded-2xl overflow-hidden min-h-0"
        style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
      >
        <ChatWindow initialMessages={messages} userId={user.id} />
      </div>
    </div>
  )
}
