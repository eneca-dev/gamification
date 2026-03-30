'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

import { SendGratitudeModal } from './SendGratitudeModal'
import type { SenderQuota, GratitudeRecipient } from '../types'

interface SendGratitudeButtonProps {
  senderId: string
  quota: SenderQuota
  recipients: GratitudeRecipient[]
  balance: number
}

export function SendGratitudeButton({ senderId, quota, recipients, balance }: SendGratitudeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-bold transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, var(--apex-primary), var(--apex-primary-hover))',
          color: 'white',
          boxShadow: '0 2px 8px rgba(27,107,88,0.25)',
        }}
      >
        <Heart size={14} fill="white" />
        Благодарность
        {!quota.used && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: '#FF9800', boxShadow: '0 0 4px rgba(255,152,0,0.5)' }}
          />
        )}
      </button>

      <SendGratitudeModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        senderId={senderId}
        quota={quota}
        recipients={recipients}
        balance={balance}
      />
    </>
  )
}
