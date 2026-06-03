'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

import { createSupabaseBrowserClient } from '@/config/supabase.client'
import { triggerReembed } from '../actions'

type Status = 'idle' | 'pending' | 'waiting' | 'done' | 'error'

export function ReembedButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null>(null)

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [])

  function subscribeToCompletion() {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('reembed-log')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chatbot_reembed_log' },
        (payload) => {
          const row = payload.new as { status: string; error: string | null }
          if (row.status === 'done') {
            channel.unsubscribe()
            channelRef.current = null
            setStatus('done')
            router.refresh()
          } else if (row.status === 'error') {
            channel.unsubscribe()
            channelRef.current = null
            setStatus('error')
            setErrorMsg(row.error ?? 'Ошибка векторизации')
          }
        }
      )
      .subscribe()
    channelRef.current = channel
  }

  function handleClick() {
    setStatus('pending')
    setErrorMsg(null)
    startTransition(async () => {
      const result = await triggerReembed()
      if (result.success) {
        setStatus('waiting')
        subscribeToCompletion()
      } else {
        setStatus('error')
        setErrorMsg(result.error)
      }
    })
  }

  const isLoading = isPending || status === 'waiting'

  return (
    <div className="flex items-center gap-3">
      {status === 'waiting' && (
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Векторизация выполняется —{' '}
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              можно уйти со страницы
            </span>
          </span>
        </div>
      )}
      {status === 'done' && (
        <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--apex-primary)' }}>
          <CheckCircle size={14} />
          Векторизация завершена, чанки обновлены
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--apex-danger)' }}>
          <AlertCircle size={14} />
          {errorMsg}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors disabled:opacity-50"
        style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Обновить чанки
      </button>
    </div>
  )
}
